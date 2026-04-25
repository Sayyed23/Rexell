"""
FastAPI application for the Challenge Service.

Exposes POST /v1/verify-challenge for challenge response validation.
Includes:
- Lifespan context manager for Redis connection setup/teardown
- API key authentication (X-API-Key header)
- Pydantic request/response validation via ChallengeResponse / ChallengeResult
- Exception handlers for ChallengeNotFoundError, ChallengeExpiredError, and generic errors
- Verification token generation on successful challenge completion (HMAC-SHA256, base64, 5-min expiry)
- PostgreSQL challenge_state update on each attempt

Requirements: 4.1, 4.4, 4.5, 4.6
"""

import base64
import hashlib
import hmac
import json
import logging
import os
import uuid
from contextlib import asynccontextmanager
from typing import Optional

import redis.asyncio as aioredis
from fastapi import Depends, FastAPI, HTTPException, Request, status
from fastapi.responses import JSONResponse

from .auth import require_api_key
from .challenge_engine import (
    ChallengeExpiredError,
    ChallengeNotFoundError,
    ChallengeValidator,
)
from .models import ChallengeResponse, ChallengeResult

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Shared module imports (path configured via conftest.py / PYTHONPATH)
# ---------------------------------------------------------------------------
try:
    from shared.db.session import get_engine, get_session_maker
    from shared.db.repositories import ChallengeStateRepository, VerificationTokenRepository
    from shared.utils.crypto import hash_wallet_address
    from shared.utils.time_utils import current_timestamp, calculate_token_expires_at
    from shared.config import settings
except ImportError as exc:
    raise ImportError(
        "Failed to import shared modules. Ensure PYTHONPATH includes "
        f"services/shared/src. Original error: {exc}"
    ) from exc

# ---------------------------------------------------------------------------
# Token generation (mirrors Detection Service handler._generate_verification_token)
# ---------------------------------------------------------------------------

_TOKEN_SIGNING_KEY = os.getenv("TOKEN_SIGNING_KEY")
if not _TOKEN_SIGNING_KEY:
    if os.getenv("ENVIRONMENT", "development") != "development":
        raise RuntimeError("TOKEN_SIGNING_KEY must be set in non-development environments")
    _TOKEN_SIGNING_KEY = "dev-signing-key-insecure"

def _generate_verification_token(
    wallet_address: str,
    event_id: Optional[str],
    max_quantity: Optional[int],
    token_id: Optional[str] = None,
    issued_at: Optional[int] = None,
    expires_at: Optional[int] = None,
) -> tuple[str, str, int, int]:
    """
    Generate an HMAC-SHA256 signed verification token encoded as base64.

    Returns ``(token_string, token_id, issued_at, expires_at)`` so the caller
    can persist the same identifier and timestamps to the database. Without
    that, the embedded ``tokenId`` would not match any row and downstream
    ``/v1/validate-token`` / ``/v1/consume-token`` calls would always fail.

    Requirements: 5.4, 5.5
    """
    token_id = token_id or str(uuid.uuid4())
    issued_at = issued_at if issued_at is not None else current_timestamp()
    expires_at = (
        expires_at if expires_at is not None else calculate_token_expires_at()
    )

    payload = {
        "tokenId": token_id,
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
    token_bytes = json.dumps(
        token_data, separators=(",", ":"), sort_keys=True
    ).encode("utf-8")
    return (
        base64.b64encode(token_bytes).decode("utf-8"),
        token_id,
        issued_at,
        expires_at,
    )


# ---------------------------------------------------------------------------
# Lifespan: initialise and teardown shared resources
# ---------------------------------------------------------------------------


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Manage application lifecycle resources.

    On startup:
    - Create async PostgreSQL engine and session factory
    - Connect to Redis
    - Instantiate ChallengeValidator

    On shutdown:
    - Close Redis connection
    - Dispose DB engine
    """
    logging.basicConfig(
        level=os.getenv("LOG_LEVEL", "INFO"),
        format="%(asctime)s %(levelname)s %(name)s %(message)s",
    )
    logger.info("Challenge Service starting up")

    # PostgreSQL
    db_url = os.getenv("DATABASE_URL", settings.DATABASE_URL)
    engine = get_engine(db_url)
    session_factory = get_session_maker(engine)
    app.state.session_factory = session_factory
    app.state.engine = engine

    # Redis
    redis_url = os.getenv("REDIS_URL", settings.REDIS_URL)
    redis_client = aioredis.from_url(
        redis_url,
        encoding="utf-8",
        decode_responses=True,
        max_connections=settings.REDIS_POOL_SIZE,
    )
    app.state.redis = redis_client

    # ChallengeValidator (stateless; depends only on Redis)
    app.state.validator = ChallengeValidator(redis_client=redis_client)

    logger.info(
        "Challenge Service ready (redis=%s db=%s)",
        redis_url,
        db_url.split("@")[-1] if "@" in db_url else db_url,
    )

    yield

    # Teardown
    logger.info("Challenge Service shutting down")
    await redis_client.aclose()
    await engine.dispose()
    logger.info("Challenge Service shutdown complete")


# ---------------------------------------------------------------------------
# Application factory
# ---------------------------------------------------------------------------


def create_app() -> FastAPI:
    """Create and configure the FastAPI application for the Challenge Service."""

    app = FastAPI(
        title="Rexell Challenge Service",
        version="1.0.0",
        description="Adaptive verification challenge validation for the Rexell ticketing platform",
        lifespan=lifespan,
    )

    # ------------------------------------------------------------------
    # Exception handlers
    # ------------------------------------------------------------------

    @app.exception_handler(ChallengeNotFoundError)
    async def challenge_not_found_handler(
        request: Request, exc: ChallengeNotFoundError
    ):
        """Return 404 when the challenge_id is not found in Redis."""
        logger.warning(
            "Challenge not found: %s (path=%s)", exc, request.url.path
        )
        return JSONResponse(
            status_code=status.HTTP_404_NOT_FOUND,
            content={
                "error_code": "CHALLENGE_NOT_FOUND",
                "message": str(exc),
            },
        )

    @app.exception_handler(ChallengeExpiredError)
    async def challenge_expired_handler(
        request: Request, exc: ChallengeExpiredError
    ):
        """Return 410 Gone when the challenge has expired."""
        logger.info(
            "Challenge expired: %s (path=%s)", exc, request.url.path
        )
        return JSONResponse(
            status_code=status.HTTP_410_GONE,
            content={
                "error_code": "CHALLENGE_EXPIRED",
                "message": str(exc),
            },
        )

    @app.exception_handler(HTTPException)
    async def http_exception_handler(request: Request, exc: HTTPException):
        """Return structured error bodies for all HTTP exceptions."""
        detail = exc.detail
        if isinstance(detail, dict):
            body = detail
        else:
            body = {"error_code": f"HTTP_{exc.status_code}", "message": str(detail)}

        headers = getattr(exc, "headers", None) or {}
        return JSONResponse(
            status_code=exc.status_code,
            content=body,
            headers=headers,
        )

    @app.exception_handler(ValueError)
    async def value_error_handler(request: Request, exc: ValueError):
        """Handle validation errors as 400 Bad Request."""
        logger.warning(
            "Validation error: %s (path=%s)", exc, request.url.path
        )
        # Only surface the original message for known user-facing validation errors.
        # Generic ValueErrors may contain internal details, so return a safe fallback.
        from .challenge_engine import ChallengeNotFoundError, ChallengeExpiredError  # noqa: F401
        if isinstance(exc, (ChallengeNotFoundError, ChallengeExpiredError)):
            client_message = str(exc)
        else:
            client_message = "Invalid request"
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content={"error_code": "VALIDATION_ERROR", "message": client_message},
        )

    @app.exception_handler(Exception)
    async def generic_exception_handler(request: Request, exc: Exception):
        """Catch-all handler for unexpected errors — returns 500."""
        logger.error(
            "Unhandled exception on %s: %s",
            request.url.path,
            exc,
            exc_info=True,
        )
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={
                "error_code": "INTERNAL_SERVER_ERROR",
                "message": "An unexpected error occurred. Please try again later.",
            },
        )

    # ------------------------------------------------------------------
    # Routes
    # ------------------------------------------------------------------

    @app.post(
        "/v1/verify-challenge",
        response_model=ChallengeResult,
        status_code=status.HTTP_200_OK,
        summary="Validate a user's response to a verification challenge",
    )
    async def verify_challenge(
        request: Request,
        body: ChallengeResponse,
        api_key: str = Depends(require_api_key),
    ) -> ChallengeResult:
        """
        POST /v1/verify-challenge

        Validates the user's response to a previously issued challenge.

        Flow:
        1. Retrieve challenge state from Redis by challenge_id.
        2. Validate the response against the stored correct answer.
        3. Update attempt count in Redis and PostgreSQL challenge_state.
        4. On success: apply −30 risk score adjustment, generate verification token.
        5. On failure: apply +10 risk score adjustment; after 3 failures, enforce
           15-minute cooldown (block:{user_hash} key in Redis).

        Returns ChallengeResult with success flag, risk_score_adjustment,
        remaining_attempts, and optional blocked_until timestamp.

        Requires X-API-Key header authentication.

        Requirements: 4.4, 4.5, 4.6
        """
        challenge_id = str(body.challenge_id)
        validator: ChallengeValidator = request.app.state.validator

        # Validate the challenge response (may raise ChallengeNotFoundError /
        # ChallengeExpiredError — handled by exception handlers above)
        result = await validator.validate_challenge(
            challenge_id=challenge_id,
            response_data=body.response_data,
        )

        # Persist attempt update to PostgreSQL challenge_state table
        async with request.app.state.session_factory() as session:
            await _update_challenge_state_in_db(
                session=session,
                challenge_id=challenge_id,
                success=result.success,
            )

        # On success, generate a verification token and attach it to the result
        if result.success:
            # Retrieve user context from Redis state to populate the token
            wallet_address, event_id = await _get_challenge_context(
                redis_client=request.app.state.redis,
                challenge_id=challenge_id,
            )

            if wallet_address is None:
                logger.warning(
                    "Challenge %s completed but wallet_address is absent in Redis; "
                    "skipping token generation",
                    challenge_id,
                )
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail={
                        "error_code": "CHALLENGE_CONTEXT_MISSING",
                        "message": "Challenge context is no longer available. Please restart the flow.",
                    },
                )
            token, token_id, issued_at, expires_at = _generate_verification_token(
                wallet_address=wallet_address,
                event_id=event_id,
                max_quantity=None,
            )

            # Persist token record to PostgreSQL using the SAME token_id /
            # timestamps embedded in the signed token, so /v1/validate-token
            # and /v1/consume-token can look the row up by id.
            async with request.app.state.session_factory() as session:
                token_repo = VerificationTokenRepository(session)
                user_hash = hash_wallet_address(wallet_address) if wallet_address else ""
                await token_repo.create(
                    user_hash=user_hash,
                    event_id=event_id,
                    token_id=token_id,
                    issued_at=issued_at,
                    expires_at=expires_at,
                )
                await session.commit()

            logger.info(
                "Challenge %s completed successfully; token issued",
                challenge_id,
            )

            # ChallengeResult does not have a token field per the model spec,
            # so return the token via response header.
            return JSONResponse(
                content=result.model_dump(),
                headers={"X-Verification-Token": token},
            )
        logger.info(
            "Challenge %s failed; remaining_attempts=%d blocked_until=%s",
            challenge_id,
            result.remaining_attempts,
            result.blocked_until,
        )
        return result

    @app.get(
        "/v1/health",
        summary="Health check endpoint",
        status_code=status.HTTP_200_OK,
    )
    async def health(request: Request):
        """
        GET /v1/health

        Returns the health status of the Challenge Service and its dependencies.
        Response time target: < 50ms.
        """
        db_status = "unknown"
        cache_status = "unknown"

        # Check PostgreSQL
        try:
            async with request.app.state.session_factory() as session:
                import sqlalchemy
                await session.execute(sqlalchemy.text("SELECT 1"))
            db_status = "healthy"
        except Exception:
            db_status = "unhealthy"

        # Check Redis
        try:
            await request.app.state.redis.ping()
            cache_status = "healthy"
        except Exception:
            cache_status = "unhealthy"

        overall = (
            "healthy"
            if all(s == "healthy" for s in [db_status, cache_status])
            else "degraded"
        )

        return {
            "status": overall,
            "version": "1.0.0",
            "services": {
                "database": db_status,
                "cache": cache_status,
            },
        }

    return app


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


async def _update_challenge_state_in_db(
    session,
    challenge_id: str,
    success: bool,
) -> None:
    """
    Update the challenge_state record in PostgreSQL.

    Increments the attempt count and sets status to 'completed' on success.
    Silently ignores DB errors to avoid blocking the API response — the
    authoritative state lives in Redis.

    Args:
        session: Active AsyncSession.
        challenge_id: UUID string of the challenge.
        success: Whether the challenge was completed successfully.
    """
    try:
        repo = ChallengeStateRepository(session)
        new_status = "completed" if success else "pending"
        await repo.update_status(
            challenge_id=challenge_id,
            status=new_status,
            increment_attempts=not success,
        )
        await session.commit()
    except Exception as exc:
        logger.warning(
            "Failed to update challenge_state in DB for challenge_id=%s: %s",
            challenge_id,
            exc,
        )


async def _get_challenge_context(
    redis_client: aioredis.Redis,
    challenge_id: str,
) -> tuple:
    """
    Retrieve wallet_address and event_id from the Redis challenge state.

    Returns (None, None) if the state is missing, expired, or wallet_address
    is empty — callers must check for None before generating tokens.

    Args:
        redis_client: Async Redis client.
        challenge_id: UUID string of the challenge.

    Returns:
        Tuple of (wallet_address, event_id).
        wallet_address is None when the context is absent or the address is empty.
        event_id is None when not stored.
    """
    try:
        raw = await redis_client.get(f"challenge:{challenge_id}")
        if raw:
            state = json.loads(raw)
            # wallet_address may not be stored in all challenge states
            # (detection service stores user_hash, not raw address)
            wallet_address = state.get("wallet_address") or None
            event_id = state.get("event_id", None)
            return wallet_address, event_id
    except Exception as exc:
        logger.warning(
            "Failed to retrieve challenge context from Redis for %s: %s",
            challenge_id,
            exc,
        )
    return None, None


# ---------------------------------------------------------------------------
# Application instance
# ---------------------------------------------------------------------------

app = create_app()
