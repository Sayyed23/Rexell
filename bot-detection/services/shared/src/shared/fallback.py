"""
Fallback mode controller for the Rexell bot-detection platform.

Implements Task 12 from the spec. When the detection service health check
fails, the platform enters fallback mode: bot detection is bypassed and a
conservative per-wallet-per-event rate limit is applied instead. When the
detection service recovers, normal operation resumes within the configured
recovery window.

Requirements: 10.1, 10.2, 10.3
"""

from __future__ import annotations

import asyncio
import logging
from typing import Awaitable, Callable, Optional

import httpx
import redis.asyncio as aioredis

logger = logging.getLogger(__name__)


FALLBACK_REDIS_KEY = "fallback:active"
FALLBACK_TTL_SECONDS = 120
FALLBACK_PURCHASE_LIMIT = 2  # max tickets per wallet per event in fallback
FALLBACK_POLL_INTERVAL_SECONDS = 10.0
FALLBACK_RECOVERY_SECONDS = 60  # resume normal ops within this window


HealthCheckFn = Callable[[], Awaitable[bool]]


class FallbackController:
    """Polls the detection service health endpoint and toggles fallback mode."""

    def __init__(
        self,
        redis_client: aioredis.Redis,
        health_check: HealthCheckFn,
        poll_interval: float = FALLBACK_POLL_INTERVAL_SECONDS,
        ttl: int = FALLBACK_TTL_SECONDS,
    ) -> None:
        self.redis = redis_client
        self.health_check = health_check
        self.poll_interval = poll_interval
        self.ttl = ttl
        self._task: Optional[asyncio.Task[None]] = None

    async def start(self) -> None:
        if self._task is None or self._task.done():
            self._task = asyncio.create_task(self._loop(), name="fallback-controller")

    async def stop(self) -> None:
        if self._task is None:
            return
        self._task.cancel()
        try:
            await self._task
        except (asyncio.CancelledError, Exception):  # noqa: BLE001
            pass
        self._task = None

    async def _loop(self) -> None:
        while True:
            try:
                healthy = await self.health_check()
                if healthy:
                    await self.deactivate()
                else:
                    await self.activate()
            except asyncio.CancelledError:
                raise
            except Exception:  # noqa: BLE001
                logger.exception("Fallback controller health-check errored")
                await self.activate()
            await asyncio.sleep(self.poll_interval)

    async def activate(self) -> None:
        """Mark fallback as active in Redis with a short TTL."""
        await self.redis.set(FALLBACK_REDIS_KEY, "1", ex=self.ttl)

    async def deactivate(self) -> None:
        await self.redis.delete(FALLBACK_REDIS_KEY)

    async def is_active(self) -> bool:
        return bool(await self.redis.exists(FALLBACK_REDIS_KEY))

    # Lua script: atomically INCRBY, set TTL on first write, and roll back
    # if the resulting total exceeds the cap. Doing the check + rollback in
    # a separate round-trip leaves a TOCTOU window where two concurrent
    # callers can both see an inflated total, both roll back, and both be
    # denied even though one should have been allowed. EVAL runs the whole
    # script atomically on the Redis server.
    _CHECK_PURCHASE_LIMIT_LUA = """
    local current = redis.call('INCRBY', KEYS[1], ARGV[1])
    if tonumber(current) == tonumber(ARGV[1]) then
        redis.call('EXPIRE', KEYS[1], ARGV[3])
    end
    if tonumber(current) > tonumber(ARGV[2]) then
        redis.call('DECRBY', KEYS[1], ARGV[1])
        return 0
    end
    return 1
    """

    async def check_purchase_limit(
        self,
        user_hash: str,
        event_id: str,
        quantity: int = 1,
        max_tickets: int = FALLBACK_PURCHASE_LIMIT,
    ) -> bool:
        """
        Atomically reserve ``quantity`` tickets for this wallet/event pair.
        Returns True if the request stays within the fallback limit.
        """
        key = f"fallback:tickets:{event_id}:{user_hash}"
        result = await self.redis.eval(
            self._CHECK_PURCHASE_LIMIT_LUA,
            1,
            key,
            quantity,
            max_tickets,
            3600,
        )
        return bool(int(result))


async def make_health_check(http_client: httpx.AsyncClient, path: str = "/v1/health") -> bool:
    """Default health-check implementation for the Detection Service."""
    try:
        resp = await http_client.get(path, timeout=1.0)
        if resp.status_code != 200:
            return False
        body = resp.json()
        return body.get("status") in {"healthy", "ok"}
    except Exception:  # noqa: BLE001
        return False


__all__ = [
    "FallbackController",
    "FALLBACK_REDIS_KEY",
    "FALLBACK_PURCHASE_LIMIT",
    "FALLBACK_RECOVERY_SECONDS",
    "make_health_check",
]
