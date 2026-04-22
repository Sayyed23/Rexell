"""
Redis-based token-bucket rate limiter for the Detection Service.

Implements a token-bucket algorithm using Redis hashes and a Lua script
for atomic read-modify-write.

- Sustained rate: 100 req/s per API key (refill rate).
- Burst capacity: 200 tokens (maximum bucket size).
- Returns HTTP 429 with Retry-After header when the bucket is empty.

Redis key pattern: rate_limit:{api_key}
  - Hash with fields: ``tokens`` (float) and ``last_refill`` (float UNIX timestamp).
  - Each key stores the current token count and the last-refill timestamp for
    the named API key; there is no per-window sub-key.
  - TTL is set to burst/rate + 1 seconds so idle keys expire naturally.

Requirements: 7.2, 7.3, 7.4
"""

import time
from typing import Optional

import redis.asyncio as aioredis
from fastapi import Request, HTTPException, status

from .logger import get_logger

logger = get_logger(__name__)

# Rate limit configuration
RATE_LIMIT_REQUESTS_PER_SECOND = 100  # Token refill rate (sustained limit)
BURST_CAPACITY = 200                  # Maximum bucket size (burst limit)
WINDOW_SECONDS = 1                    # Kept for backward-compat; not used by token bucket
REDIS_KEY_TTL = BURST_CAPACITY // RATE_LIMIT_REQUESTS_PER_SECOND + 1  # seconds until full bucket drains

# Lua script: atomically refill tokens based on elapsed time, then consume one.
# Returns a two-element array: {allowed (0|1), floor(tokens_after)}
_TOKEN_BUCKET_SCRIPT = """
local key         = KEYS[1]
local now         = tonumber(ARGV[1])
local refill_rate = tonumber(ARGV[2])
local capacity    = tonumber(ARGV[3])
local ttl         = tonumber(ARGV[4])

local data = redis.call('HMGET', key, 'tokens', 'last_refill')
local tokens      = tonumber(data[1])
local last_refill = tonumber(data[2])

if tokens == nil then
    -- First request: start with a full bucket minus the token we're about to consume
    tokens = capacity - 1
    redis.call('HMSET', key, 'tokens', tokens, 'last_refill', now)
    redis.call('EXPIRE', key, ttl)
    return {1, math.floor(tokens)}
end

-- Refill proportionally to elapsed time
local elapsed = now - last_refill
local refilled = elapsed * refill_rate
tokens = math.min(capacity, tokens + refilled)

if tokens < 1 then
    -- Not enough tokens — update timestamp but do not consume
    redis.call('HMSET', key, 'tokens', tokens, 'last_refill', now)
    redis.call('EXPIRE', key, ttl)
    return {0, 0}
end

tokens = tokens - 1
redis.call('HMSET', key, 'tokens', tokens, 'last_refill', now)
redis.call('EXPIRE', key, ttl)
return {1, math.floor(tokens)}
"""


class SlidingWindowRateLimiter:
    """
    Redis token-bucket rate limiter.

    Tokens refill continuously at ``limit`` tokens/second up to ``burst``
    capacity. Each accepted request consumes one token. Requests are
    rejected when the bucket is empty.

    The bucket state (token count + last-refill timestamp) is stored in a
    Redis hash and updated atomically via a Lua script, so no WATCH/MULTI
    retry loop is needed.

    Attributes:
        redis: Async Redis client.
        limit: Token refill rate in tokens per second (sustained rate).
        burst: Maximum bucket capacity (burst limit).
        window: Kept for API compatibility; not used by the token bucket.
    """

    def __init__(
        self,
        redis_client: aioredis.Redis,
        limit: int = RATE_LIMIT_REQUESTS_PER_SECOND,
        burst: int = BURST_CAPACITY,
        window: int = WINDOW_SECONDS,
    ):
        self.redis = redis_client
        self.limit = limit
        self.burst = burst
        self.window = window
        self._script = self.redis.register_script(_TOKEN_BUCKET_SCRIPT)

    async def check_rate_limit(self, api_key: str) -> tuple[bool, int, int]:
        """
        Check whether the given API key is within its rate limit.

        Uses a Redis hash keyed by ``rate_limit:{api_key}`` to persist the
        token-bucket state (current tokens + last-refill timestamp). A Lua
        script atomically refills tokens based on elapsed time and consumes
        one token if available.

        Args:
            api_key: The API key to check.

        Returns:
            Tuple of (allowed: bool, current_count: int, retry_after: int).
            - allowed: True if a token was successfully consumed.
            - current_count: Remaining tokens after this request (floor).
            - retry_after: Seconds to wait before retrying (0 if allowed).
        """
        now = time.time()
        redis_key = f"rate_limit:{api_key}"
        ttl = REDIS_KEY_TTL

        result = await self._script(
            keys=[redis_key],
            args=[now, self.limit, self.burst, ttl],
        )

        allowed = bool(int(result[0]))
        tokens_remaining = int(result[1])

        if not allowed:
            retry_after = max(1, int(1.0 / self.limit))
            logger.warning(
                "Rate limit exceeded",
                event="rate_limit_exceeded",
                api_key_prefix=api_key[:8],
                tokens_remaining=tokens_remaining,
                refill_rate=self.limit,
                burst_capacity=self.burst,
                retry_after=retry_after,
            )
            return False, tokens_remaining, retry_after

        return True, tokens_remaining, 0

    async def is_allowed(self, api_key: str) -> bool:
        """
        Convenience method: returns True if the request is allowed.

        Args:
            api_key: The API key to check.

        Returns:
            True if within rate limits, False otherwise.
        """
        allowed, _, _ = await self.check_rate_limit(api_key)
        return allowed


async def rate_limit_dependency(
    request: Request,
) -> None:
    """
    FastAPI dependency that enforces rate limiting.

    Reads the API key from the request state (set by auth middleware)
    or falls back to the X-API-Key header. Raises HTTP 429 if the
    rate limit is exceeded.

    Args:
        request: The incoming FastAPI request.

    Raises:
        HTTPException 429: If the rate limit is exceeded.
        HTTPException 503: If Redis is unavailable.
    """
    # Get the rate limiter from app state
    rate_limiter: Optional[SlidingWindowRateLimiter] = getattr(
        request.app.state, "rate_limiter", None
    )
    if rate_limiter is None:
        # Rate limiter not configured — allow request through
        return

    # Get API key from request state (set by auth middleware) or fall back to header
    api_key = getattr(request.state, "api_key", None) or request.headers.get("X-API-Key", "anonymous")

    try:
        allowed, count, retry_after = await rate_limiter.check_rate_limit(api_key)
    except Exception as exc:
        logger.error(
            "Rate limiter Redis error",
            event="rate_limiter_error",
            error=str(exc),
        )
        # Fail open: allow request if Redis is unavailable
        return

    if not allowed:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail={
                "error_code": "RATE_LIMIT_EXCEEDED",
                "message": "Too many requests. Please retry after the indicated delay.",
                "retry_after": retry_after,
            },
            headers={"Retry-After": str(retry_after)},
        )
