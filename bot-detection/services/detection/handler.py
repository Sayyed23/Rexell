"""
Bot detection orchestration handler for the Detection Service.

Coordinates the full detection pipeline:
1. Validate incoming behavioral data
2. Hash wallet address for anonymization
3. Query user history from PostgreSQL (cache miss) or Redis (cache hit)
4. Extract features using BehavioralAnalyzer
5. Calculate risk score using RiskScorer
6. Apply decision logic:
   - score < 50  → allow + generate verification token
   - 50 ≤ score ≤ 80 → challenge + return challenge_id and type
   - score > 80  → block + log event
7. Store risk score and decision in PostgreSQL risk_scores table

Requirements: 1.1, 1.2, 1.3, 1.4
"""

import base64
import hashlib
import hmac
import json
import os
import uuid
from typing import Optional

import redis.asyncio as aioredis
from sqlalchemy.ext.asyncio import AsyncSession

from .logger import get_logger, log_detection_event, get_correlation_id

logger = get_logger(__name__)

# Import shared components — path configured via conftest.py / sys.path
try:
    from shared.models.types import (
        DetectionRequest,
        DetectionResponse,
        DetectionResponseDecision,
        RiskContext,
        RISK_THRESHOLD_BLOCK,
        RISK_THRESHOLD_CHALLENGE,
        ChallengeType,
    )
    from shared.analyzer import BehavioralAnalyzer
    from shared.risk_scorer import RiskScorer
    from shared.utils.crypto import hash_wallet_address
    from shared.utils.time_utils import current_timestamp, calculate_token_expires_at
    from shared.db.repositories import (
        BehavioralDataRepository,
        RiskScoreRepository,
        VerificationTokenRepository,
    )
    from shared.clients.ml_client import MLInferenceClient
except ImportError as e:
    raise ImportError(
        f"Failed to import shared modules. Ensure PYTHONPATH includes "
        f"services/shared/src. Original error: {e}"
    ) from e

# Token signing key from environment
_TOKEN_SIGNING_KEY = os.getenv("TOKEN_SIGNING_KEY")
_IS_PRODUCTION = os.getenv("ENVIRONMENT", "development").lower() == "production"

if not _TOKEN_SIGNING_KEY:
    if _IS_PRODUCTION:
        raise RuntimeError("TOKEN_SIGNING_KEY must be set in production environment")
    logger.warning(
        "insecure_signing_key",
        message="TOKEN_SIGNING_KEY not set, using insecure default. Do not use in production!",
    )
    _TOKEN_SIGNING_KEY = "dev-signing-key-insecure"
# Challenge score boundaries (mirrors challenge_engine.py)
_CHALLENGE_SCORE_MID = 65


def _select_challenge_type(risk_score: float) -> ChallengeType:
    """Select challenge type based on risk score."""
    if risk_score <= _CHALLENGE_SCORE_MID:
        return ChallengeType.image_selection
    return ChallengeType.multi_step


def _generate_verification_token(
    wallet_address: str,
    event_id: Optional[str],
    max_quantity: Optional[int],
) -> str:
    """
    Generate an HMAC-SHA256 signed verification token encoded as base64.

    Token payload includes:
    - tokenId (UUID v4)
    - walletAddress
    - eventId
    - maxQuantity
    - issuedAt (Unix timestamp seconds)
    - expiresAt (issuedAt + 5 minutes)

    Returns:
        Base64-encoded JSON token string.
    """
    issued_at = current_timestamp()
    expires_at = calculate_token_expires_at()

    payload = {
        "tokenId": str(uuid.uuid4()),
        "walletAddress": wallet_address,
        "eventId": event_id,
        "maxQuantity": max_quantity,
        "issuedAt": issued_at,
        "expiresAt": expires_at,
    }

    payload_json = json.dumps(payload, separators=(",", ":"), sort_keys=True)
    signature = hmac.new(
        _TOKEN_SIGNING_KEY.encode("utf-8"),
        payload_json.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()

    token_data = {**payload, "signature": signature}
    token_bytes = json.dumps(token_data, separators=(",", ":"), sort_keys=True).encode(
        "utf-8"
    )
    return base64.b64encode(token_bytes).decode("utf-8")


class DetectionHandler:
    """
    Orchestrates the full bot detection pipeline for a single request.

    Dependencies are injected to allow unit testing with mocks.
    """

    def __init__(
        self,
        analyzer: BehavioralAnalyzer,
        risk_scorer: RiskScorer,
        behavioral_repo: BehavioralDataRepository,
        risk_score_repo: RiskScoreRepository,
        token_repo: VerificationTokenRepository,
        redis_client: aioredis.Redis,
    ):
        self.analyzer = analyzer
        self.risk_scorer = risk_scorer
        self.behavioral_repo = behavioral_repo
        self.risk_score_repo = risk_score_repo
        self.token_repo = token_repo
        self.redis = redis_client

    async def handle(
        self,
        request: DetectionRequest,
        correlation_id: Optional[str] = None,
    ) -> DetectionResponse:
        """
        Execute the full detection pipeline and return a DetectionResponse.

        Args:
            request: Validated DetectionRequest from the API layer.
            correlation_id: Optional correlation ID for distributed tracing.

        Returns:
            DetectionResponse with decision, risk score, and optional token/challenge.
        """
        cid = correlation_id or get_correlation_id()
        behavioral_data = request.behavioralData
        context = request.context or RiskContext()

        session_id = behavioral_data.sessionId
        wallet_address = behavioral_data.walletAddress
        user_hash = hash_wallet_address(wallet_address)

        logger.info(
            "detection_start",
            message="Detection pipeline started",
            session_id=session_id,
            user_hash=user_hash,
            correlation_id=cid,
        )

        # Step 1: Store behavioral data
        events_list = [e.model_dump() for e in behavioral_data.events]
        behavioral_record = await self.behavioral_repo.create(
            session_id=session_id,
            wallet_address=wallet_address,
            user_agent=behavioral_data.userAgent,
            ip_address=behavioral_data.ipAddress,
            events=events_list,
        )

        # Step 2: Extract features
        features = self.analyzer.extract_features(behavioral_data)

        # Step 3: Calculate risk score (includes ML inference + reputation)
        risk_score_result = await self.risk_scorer.calculate_risk_score(
            user_hash=user_hash,
            features=features,
            context=context,
        )

        score = risk_score_result.score
        decision = risk_score_result.decision
        factors_list = [f.model_dump() for f in risk_score_result.factors]

        # Step 4: Persist risk score to PostgreSQL
        await self.risk_score_repo.create(
            session_id=session_id,
            user_hash=user_hash,
            score=score,
            decision=decision.value,
            factors=factors_list,
            behavioral_data_id=behavioral_record.id,
        )

        # Step 5: Apply decision logic
        response = await self._apply_decision(
            decision=decision,
            score=score,
            wallet_address=wallet_address,
            user_hash=user_hash,
            session_id=session_id,
            context=context,
            cid=cid,
        )

        # Step 6: Log detection event (Requirement 1.5, 8.1)
        log_detection_event(
            logger,
            session_id=session_id,
            user_hash=user_hash,
            risk_score=score,
            decision=decision.value,
            correlation_id=cid,
            extra={
                "factors": [f["factor"] for f in factors_list],
                "is_bulk_purchase": context.isBulkPurchase,
            },
        )

        return response

    async def _apply_decision(
        self,
        decision: DetectionResponseDecision,
        score: float,
        wallet_address: str,
        user_hash: str,
        session_id: str,
        context: RiskContext,
        cid: str,
    ) -> DetectionResponse:
        """
        Build the DetectionResponse based on the risk decision.

        - allow  → generate verification token
        - challenge → select challenge type, create challenge record
        - block  → log block event, return block response
        """
        if decision == DetectionResponseDecision.allow:
            token = _generate_verification_token(
                wallet_address=wallet_address,
                event_id=getattr(context, "eventId", None),
                max_quantity=context.requestedQuantity,
            )
            logger.info(
                "detection_allow",
                message="Detection decision: allow",
                session_id=session_id,
                user_hash=user_hash,
                risk_score=round(score, 2),
                correlation_id=cid,
            )
            return DetectionResponse(
                decision=DetectionResponseDecision.allow,
                riskScore=score,
                verificationToken=token,
            )

        elif decision == DetectionResponseDecision.challenge:
            challenge_type = _select_challenge_type(score)
            challenge_id = str(uuid.uuid4())

            # Store minimal challenge state in Redis (5-minute TTL)
            redis_key = f"challenge:{challenge_id}"
            challenge_state = {
                "challenge_id": challenge_id,
                "challenge_type": challenge_type.value,
                "session_id": session_id,
                "user_hash": user_hash,
                "attempts": 0,
                "status": "pending",
            }
            try:
                await self.redis.setex(redis_key, 300, json.dumps(challenge_state))
            except Exception as redis_exc:
                logger.error(
                    "challenge_redis_write_error",
                    message="Failed to store challenge state in Redis; blocking request",
                    challenge_id=challenge_id,
                    redis_key=redis_key,
                    session_id=session_id,
                    user_hash=user_hash,
                    error=str(redis_exc),
                    exc_info=True,
                )
                # Fall back to a block response so the client never receives a
                # challenge_id that does not exist in Redis.
                challenge_state["status"] = "blocked"
                return DetectionResponse(
                    decision=DetectionResponseDecision.block,
                    riskScore=score,
                )

            logger.warning(
                "detection_challenge",
                message="Detection decision: challenge",
                session_id=session_id,
                user_hash=user_hash,
                risk_score=round(score, 2),
                challenge_type=challenge_type.value,
                challenge_id=challenge_id,
                correlation_id=cid,
            )
            return DetectionResponse(
                decision=DetectionResponseDecision.challenge,
                riskScore=score,
                challengeId=challenge_id,
                challengeType=challenge_type,
            )

        else:  # block
            logger.error(
                "detection_block",
                message="Detection decision: block",
                session_id=session_id,
                user_hash=user_hash,
                risk_score=round(score, 2),
                correlation_id=cid,
            )
            return DetectionResponse(
                decision=DetectionResponseDecision.block,
                riskScore=score,
            )
