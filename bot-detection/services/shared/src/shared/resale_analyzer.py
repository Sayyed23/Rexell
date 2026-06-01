"""
Resale pattern analyzer and trusted status manager.

Implements Task 11 (Resale Detection Logic) from the tasks spec:

- ResalePatternAnalyzer: tracks per-user_hash resale request frequency using a
  Redis sorted set. If more than RESALE_FLAG_THRESHOLD requests are submitted
  within RESALE_WINDOW_SECONDS the account is flagged in the PostgreSQL
  user_reputation table; subsequent resale requests from flagged accounts
  require additional verification.
- TrustedStatusManager: computes a 30-day behavioral-consistency score from
  the risk_scores history, grants trusted status when the threshold is met,
  and revokes trusted status when a subsequent anomaly exceeds the configured
  anomaly threshold.

Requirements: 6.1, 6.2, 6.3, 6.4, 6.5
"""

from __future__ import annotations

import logging
import time
from typing import Awaitable, Callable, Optional

import redis.asyncio as aioredis
from sqlalchemy import func, select

from .config import settings
from .db.models import RiskScoreModel
from .db.repositories import UserReputationRepository
from .utils.time_utils import current_timestamp

logger = logging.getLogger(__name__)


RESALE_WINDOW_SECONDS = 60
RESALE_FLAG_THRESHOLD = 3  # >3 requests in 60s flags the account

TRUSTED_CONSISTENCY_WINDOW_DAYS = 30
TRUSTED_MIN_SESSIONS = 20
TRUSTED_MEAN_SCORE_MAX = 20.0  # average risk score below which user is trusted
TRUSTED_STD_DEV_MAX = 15.0  # std-dev ceiling for "consistent" behavior
TRUSTED_ANOMALY_THRESHOLD = 70.0  # single score above this triggers revocation


class ResalePatternAnalyzer:
    """Track resale request frequency per user and flag hot accounts."""

    def __init__(
        self,
        redis_client: aioredis.Redis,
        reputation_repo: UserReputationRepository,
        window_seconds: int = RESALE_WINDOW_SECONDS,
        flag_threshold: int = RESALE_FLAG_THRESHOLD,
    ) -> None:
        self.redis = redis_client
        self.repo = reputation_repo
        self.window_seconds = window_seconds
        self.flag_threshold = flag_threshold

    def _key(self, user_hash: str) -> str:
        return f"resale:{user_hash}"

    async def record_request(self, user_hash: str) -> int:
        """
        Record a resale request for ``user_hash``.

        Returns the number of requests observed inside the rolling window.
        If that count exceeds the configured threshold the account is
        flagged for review in the user_reputation table.
        """
        key = self._key(user_hash)
        now = time.time()
        cutoff = now - self.window_seconds

        pipeline = self.redis.pipeline()
        pipeline.zremrangebyscore(key, 0, cutoff)
        pipeline.zadd(key, {f"{now:.6f}": now})
        pipeline.zcard(key)
        pipeline.expire(key, self.window_seconds * 2)
        _, _, count, _ = await pipeline.execute()
        count = int(count)

        if count > self.flag_threshold:
            logger.warning(
                "Resale burst detected; flagging user %s (count=%d)",
                user_hash[:8],
                count,
            )
            await self._flag_account(user_hash)
        return count

    async def _flag_account(self, user_hash: str) -> None:
        record = await self.repo.get_or_create(user_hash)
        await self.repo.update_score(
            user_hash,
            new_score=record.reputation_score,
            flagged=True,
        )

    async def is_flagged(self, user_hash: str) -> bool:
        """Return True if the account requires additional verification."""
        record = await self.repo.get_or_create(user_hash)
        return bool(record.flagged)

    async def requires_additional_verification(self, user_hash: str) -> bool:
        return await self.is_flagged(user_hash)


class TrustedStatusManager:
    """
    Assigns or revokes ``trusted_status`` on the user_reputation row.

    Trusted users get reduced challenge requirements for resale flows.
    Revocation is driven by behavioral anomalies exceeding the configured
    threshold.
    """

    def __init__(
        self,
        reputation_repo: UserReputationRepository,
        window_days: int = TRUSTED_CONSISTENCY_WINDOW_DAYS,
        min_sessions: int = TRUSTED_MIN_SESSIONS,
        mean_score_max: float = TRUSTED_MEAN_SCORE_MAX,
        std_dev_max: float = TRUSTED_STD_DEV_MAX,
        anomaly_threshold: float = TRUSTED_ANOMALY_THRESHOLD,
    ) -> None:
        self.repo = reputation_repo
        self.window_days = window_days
        self.min_sessions = min_sessions
        self.mean_score_max = mean_score_max
        self.std_dev_max = std_dev_max
        self.anomaly_threshold = anomaly_threshold

    async def evaluate_trust(self, user_hash: str) -> bool:
        """
        Compute behavioral consistency over the configured window and update
        trusted_status on the user_reputation row. Returns the resulting
        trusted flag.
        """
        cutoff = current_timestamp() - self.window_days * 86400

        stmt = (
            select(
                func.count(RiskScoreModel.score),
                func.avg(RiskScoreModel.score),
                func.stddev_samp(RiskScoreModel.score),
                func.max(RiskScoreModel.score),
            )
            .where(RiskScoreModel.user_hash == user_hash)
            .where(RiskScoreModel.created_at >= cutoff)
        )
        result = await self.repo.session.execute(stmt)
        row = result.one()
        n = int(row[0] or 0)
        mean = float(row[1] or 0.0)
        std = float(row[2] or 0.0)
        max_score = float(row[3] or 0.0)

        trusted = (
            n >= self.min_sessions
            and mean <= self.mean_score_max
            and std <= self.std_dev_max
            and max_score < self.anomaly_threshold
        )

        record = await self.repo.get_or_create(user_hash)
        await self.repo.update_score(
            user_hash,
            new_score=record.reputation_score,
            trusted_status=trusted,
        )
        logger.info(
            "Trusted status evaluated for %s: trusted=%s (n=%d mean=%.2f std=%.2f max=%.2f)",
            user_hash[:8],
            trusted,
            n,
            mean,
            std,
            max_score,
        )
        return trusted

    async def check_and_revoke_on_anomaly(
        self,
        user_hash: str,
        latest_score: float,
    ) -> bool:
        """
        Revoke trusted status if the latest score exceeds the anomaly
        threshold. Returns True if revocation occurred.
        """
        if latest_score < self.anomaly_threshold:
            return False

        record = await self.repo.get_or_create(user_hash)
        if not record.trusted_status:
            return False

        logger.warning(
            "Revoking trusted status for %s due to anomaly score=%.2f",
            user_hash[:8],
            latest_score,
        )
        await self.repo.update_score(
            user_hash,
            new_score=record.reputation_score,
            trusted_status=False,
        )
        return True


__all__ = [
    "ResalePatternAnalyzer",
    "TrustedStatusManager",
    "RESALE_WINDOW_SECONDS",
    "RESALE_FLAG_THRESHOLD",
    "TRUSTED_CONSISTENCY_WINDOW_DAYS",
    "TRUSTED_MIN_SESSIONS",
    "TRUSTED_MEAN_SCORE_MAX",
    "TRUSTED_ANOMALY_THRESHOLD",
]
