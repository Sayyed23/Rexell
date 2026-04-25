"""
FastAPI application for the Detection Service.

Exposes POST /v1/detect for bot detection analysis.
Includes:
- Lifespan context manager for DB pool and Redis connection setup/teardown
- API key authentication (X-API-Key header)
- Redis sliding window rate limiting (100 req/s per key, burst 200)
- Structured JSON logging with correlation ID propagation
- Comprehensive exception handlers for all error categories

Requirements: 1.1, 7.1, 7.2
"""

import os
import uuid
from contextlib import asynccontextmanager
from typing import Optional

import httpx
import redis.asyncio as aioredis
from fastapi import Depends, FastAPI, HTTPException, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from .auth import require_api_key
from .handler import DetectionHandler
from .logger import configure_logging, get_logger, set_correlation_id
from .rate_limiter import SlidingWindowRateLimiter, rate_limit_dependency
from .token_validator import validate_token, consume_token
from fastapi import Response

logger = get_logger(__name__)

# ---------------------------------------------------------------------------
# Shared module imports (path configured via conftest.py / PYTHONPATH)
# ---------------------------------------------------------------------------
try:
    from shared.models.types import DetectionRequest, DetectionResponse
    from shared.analyzer import BehavioralAnalyzer
    from shared.risk_scorer import RiskScorer, ReputationService
    from shared.clients.ml_client import MLInferenceClient
    from shared.db.session import get_engine, get_session_maker
    from shared.db.repositories import (
        BehavioralDataRepository,
        RiskScoreRepository,
        VerificationTokenRepository,
        UserReputationRepository,
    )
    from shared.config import settings
    from shared.resale_analyzer import (
        ResalePatternAnalyzer,
        TrustedStatusManager,
    )
    from shared.fallback import FallbackController, make_health_check
    from shared.metrics import BotDetectionMetrics, CONTENT_TYPE_LATEST
    from shared.audit import hash_api_key, record_access
    from shared.privacy import anonymize_behavioral_payload
    from shared.db.models import (
        BehavioralDataModel,
        RiskScoreModel,
        UserReputationModel,
        ChallengeStateModel,
    )
    from sqlalchemy import delete as _sql_delete
except ImportError as exc:
    raise ImportError(
        "Failed to import shared modules. Ensure PYTHONPATH includes "
        f"services/shared/src. Original error: {exc}"
    ) from exc

# ---------------------------------------------------------------------------
# Lifespan: initialise and teardown shared resources
# ---------------------------------------------------------------------------


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Manage application lifecycle resources.

    On startup:
    - Configure structured logging
    - Create async PostgreSQL engine and session factory
    - Connect to Redis
    - Instantiate rate limiter, ML client, analyzer, risk scorer

    On shutdown:
    - Close Redis connection
    - Dispose DB engine
    """
    configure_logging(os.getenv("LOG_LEVEL", "INFO"))
    logger.info("startup", message="Detection Service starting up")

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

    # Rate limiter
    app.state.rate_limiter = SlidingWindowRateLimiter(redis_client)

    # ML HTTP client (shared across requests)
    ml_url = os.getenv("ML_INFERENCE_URL", settings.ML_INFERENCE_URL)
    http_client = httpx.AsyncClient(base_url=ml_url)
    app.state.http_client = http_client

    # Prometheus metrics
    app.state.metrics = BotDetectionMetrics()

    # Fallback-mode controller polls the local /v1/health endpoint. The
    # controller itself only takes action via Redis so this stays lightweight.
    async def _self_health() -> bool:
        try:
            await redis_client.ping()
            return True
        except Exception:  # noqa: BLE001
            return False

    fallback = FallbackController(redis_client, _self_health)
    app.state.fallback = fallback
    if os.getenv("FALLBACK_CONTROLLER_ENABLED", "false").lower() == "true":
        await fallback.start()

    logger.info(
        "startup_complete",
        message="Detection Service ready",
        db_url=db_url.split("@")[-1] if "@" in db_url else db_url,
        redis_url=redis_url.split("@")[-1] if "@" in redis_url else redis_url,
        ml_url=ml_url,
    )
    yield

    # Teardown
    logger.info("shutdown", message="Detection Service shutting down")
    await fallback.stop()
    await redis_client.aclose()
    await http_client.aclose()
    await engine.dispose()
    logger.info("shutdown_complete", message="Detection Service shutdown complete")


# ---------------------------------------------------------------------------
# Application factory
# ---------------------------------------------------------------------------


def create_app() -> FastAPI:
    """Create and configure the FastAPI application."""
    app = FastAPI(
        title="Rexell Bot Detection Service",
        version="1.0.0",
        description="Real-time bot detection for the Rexell ticketing platform",
        lifespan=lifespan,
    )

    # ------------------------------------------------------------------
    # Middleware: CORS — allow the frontend to call the API
    # ------------------------------------------------------------------
    cors_origins = os.getenv(
        "CORS_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000"
    ).split(",")

    app.add_middleware(
        CORSMiddleware,
        allow_origins=[o.strip() for o in cors_origins],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
        expose_headers=["X-Correlation-ID", "X-Verification-Token"],
    )

    # ------------------------------------------------------------------
    # Middleware: correlation ID injection
    # ------------------------------------------------------------------

    @app.middleware("http")
    async def correlation_id_middleware(request: Request, call_next):
        """
        Inject a correlation ID into every request context.

        Reads X-Correlation-ID from the request header, or generates a new UUID.
        Propagates the ID in the response header.
        """
        incoming_cid = request.headers.get("X-Correlation-ID")
        cid = set_correlation_id(incoming_cid)
        request.state.correlation_id = cid

        response = await call_next(request)
        response.headers["X-Correlation-ID"] = cid
        return response

    # ------------------------------------------------------------------
    # Exception handlers
    # ------------------------------------------------------------------

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
            "validation_error",
            message="Validation error",
            error=str(exc),
            path=request.url.path,
        )
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content={"error_code": "VALIDATION_ERROR", "message": str(exc)},
        )

    @app.exception_handler(Exception)
    async def generic_exception_handler(request: Request, exc: Exception):
        """Catch-all handler for unexpected errors — returns 500."""
        logger.error(
            "internal_error",
            message="Unhandled exception",
            error=str(exc),
            exc_info=True,
            path=request.url.path,
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
        "/v1/detect",
        response_model=DetectionResponse,
        status_code=status.HTTP_200_OK,
        summary="Analyze behavioral data and return bot detection decision",
        dependencies=[Depends(rate_limit_dependency)],
    )
    async def detect(
        request: Request,
        body: DetectionRequest,
        api_key: str = Depends(require_api_key),
    ) -> DetectionResponse:
        """
        POST /v1/detect

        Accepts behavioral data from the client SDK and returns a risk decision:
        - allow  (score < 50): issues a verification token
        - challenge (50 ≤ score ≤ 80): returns challenge type and challenge_id
        - block (score > 80): blocks the request and logs the event

        Requires X-API-Key header authentication.
        Rate limited to 100 req/s per API key (burst: 200).
        """
        cid = getattr(request.state, "correlation_id", str(uuid.uuid4()))
        metrics = request.app.state.metrics

        # Inject the client IP server-side. The SDK / frontend cannot supply
        # this reliably; honour an X-Forwarded-For header set by an upstream
        # proxy and fall back to the direct peer.
        if not body.behavioralData.ipAddress:
            xff = request.headers.get("x-forwarded-for")
            client_ip = (
                xff.split(",")[0].strip() if xff else (request.client.host if request.client else None)
            )
            body.behavioralData.ipAddress = client_ip

        # Build per-request handler with fresh DB session
        with metrics.observe_latency("/v1/detect"):
            async with request.app.state.session_factory() as session:
                handler = _build_handler(request, session)
                try:
                    response = await handler.handle(body, correlation_id=cid)
                    await session.commit()
                except Exception as exc:
                    metrics.record_error("detection_pipeline")
                    # Attempt rule-based fallback for ML service failures
                    response = await _handle_with_fallback(request, body, exc, cid)

        metrics.record_decision(response.decision.value, response.riskScore)
        fallback = getattr(request.app.state, "fallback", None)
        if fallback is not None:
            try:
                metrics.set_fallback(await fallback.is_active())
            except Exception:  # noqa: BLE001
                pass
        return response

    # ------------------------------------------------------------------
    # Request/response models for token endpoints
    # ------------------------------------------------------------------

    class ValidateTokenRequest(BaseModel):
        token: str
        walletAddress: str

    class ValidateTokenResponse(BaseModel):
        valid: bool
        reason: Optional[str] = None

    class ConsumeTokenRequest(BaseModel):
        token: str
        txHash: str

    class ConsumeTokenResponse(BaseModel):
        consumed: bool

    # ------------------------------------------------------------------
    # POST /v1/validate-token
    # ------------------------------------------------------------------

    @app.post(
        "/v1/validate-token",
        response_model=ValidateTokenResponse,
        status_code=status.HTTP_200_OK,
        summary="Validate a verification token before transaction execution",
        dependencies=[Depends(rate_limit_dependency)],
    )
    async def validate_token_endpoint(
        request: Request,
        body: ValidateTokenRequest,
        api_key: str = Depends(require_api_key),
    ) -> ValidateTokenResponse:
        """
        POST /v1/validate-token

        Validates a verification token:
        - Decodes base64 token
        - Verifies HMAC-SHA256 signature
        - Checks expiration (expiresAt > now)
        - Verifies walletAddress matches token payload
        - Checks token not already consumed (queries PostgreSQL)

        Returns {"valid": true} or {"valid": false, "reason": "..."}.

        Requirements: 5.2, 5.3
        """
        async with request.app.state.session_factory() as session:
            token_repo = VerificationTokenRepository(session)
            result = await validate_token(
                token=body.token,
                wallet_address=body.walletAddress,
                token_repo=token_repo,
            )

        if result.valid:
            return ValidateTokenResponse(valid=True)
        return ValidateTokenResponse(valid=False, reason=result.reason)

    # ------------------------------------------------------------------
    # POST /v1/consume-token
    # ------------------------------------------------------------------

    @app.post(
        "/v1/consume-token",
        response_model=ConsumeTokenResponse,
        status_code=status.HTTP_200_OK,
        summary="Mark a verification token as consumed after successful transaction",
        dependencies=[Depends(rate_limit_dependency)],
    )
    async def consume_token_endpoint(
        request: Request,
        body: ConsumeTokenRequest,
        api_key: str = Depends(require_api_key),
    ) -> ConsumeTokenResponse:
        """
        POST /v1/consume-token

        Marks a verification token as consumed:
        - Decodes and validates token signature
        - Marks consumed in PostgreSQL with consumed_at timestamp and tx_hash
        - Prevents reuse of consumed tokens

        Returns {"consumed": true} or raises HTTP 400/404 on failure.

        Requirements: 5.6
        """
        async with request.app.state.session_factory() as session:
            token_repo = VerificationTokenRepository(session)
            success, error_reason = await consume_token(
                token=body.token,
                tx_hash=body.txHash,
                token_repo=token_repo,
            )
            # Persist the consumed_at / tx_hash update. Without an explicit
            # commit, the async session context manager rolls the transaction
            # back on exit and the token can be replayed indefinitely.
            if success:
                await session.commit()

        if success:
            return ConsumeTokenResponse(consumed=True)

        # Map error reasons to appropriate HTTP status codes
        if error_reason in ("Token not found",):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={"error_code": "TOKEN_NOT_FOUND", "message": error_reason},
            )
        if error_reason in ("Token has already been consumed",):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={"error_code": "TOKEN_ALREADY_CONSUMED", "message": error_reason},
            )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"error_code": "TOKEN_CONSUMPTION_FAILED", "message": error_reason or "Token consumption failed"},
        )

    @app.get(
        "/v1/health",
        summary="Health check endpoint",
        status_code=status.HTTP_200_OK,
    )
    async def health(request: Request):
        """
        GET /v1/health

        Returns the health status of the Detection Service and its dependencies.
        Response time target: < 50ms.
        """
        db_status = "unknown"
        cache_status = "unknown"
        ml_status = "unknown"

        # Check PostgreSQL
        try:
            async with request.app.state.session_factory() as session:
                await session.execute(__import__("sqlalchemy").text("SELECT 1"))
            db_status = "healthy"
        except Exception:
            db_status = "unhealthy"

        # Check Redis
        try:
            await request.app.state.redis.ping()
            cache_status = "healthy"
        except Exception:
            cache_status = "unhealthy"

        # Check ML Inference Service
        try:
            resp = await request.app.state.http_client.get(
                "/ping", timeout=0.5
            )
            ml_status = "healthy" if resp.status_code == 200 else "degraded"
        except Exception:
            ml_status = "unhealthy"

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
                "ml_inference": ml_status,
            },
        }

    # ------------------------------------------------------------------
    # POST /v1/resale-check: resale detection pattern analyser (Task 11)
    # ------------------------------------------------------------------

    class ResaleCheckRequest(BaseModel):
        walletAddress: str
        ticketId: Optional[str] = None

    class ResaleCheckResponse(BaseModel):
        flagged: bool
        requiresAdditionalVerification: bool
        trusted: bool
        requestsInWindow: int

    @app.post(
        "/v1/resale-check",
        response_model=ResaleCheckResponse,
        status_code=status.HTTP_200_OK,
        summary="Track resale request and determine trusted/flag status",
        dependencies=[Depends(rate_limit_dependency)],
    )
    async def resale_check(
        request: Request,
        body: ResaleCheckRequest,
        api_key: str = Depends(require_api_key),
    ) -> ResaleCheckResponse:
        from shared.utils.crypto import hash_wallet_address as _hw

        user_hash = _hw(body.walletAddress)
        async with request.app.state.session_factory() as session:
            reputation_repo = UserReputationRepository(session)
            analyzer = ResalePatternAnalyzer(
                redis_client=request.app.state.redis,
                reputation_repo=reputation_repo,
            )
            count = await analyzer.record_request(user_hash)
            # record_request may have issued a core UPDATE on user_reputation
            # via _flag_account; expire the identity map so the next read
            # re-fetches the row and reflects the new ``flagged`` value.
            session.expire_all()
            record = await reputation_repo.get_or_create(user_hash)
            # Snapshot the ORM attributes BEFORE commit + session close.
            # SQLAlchemy's default expire_on_commit=True invalidates loaded
            # attributes after commit and the ``async with`` block then
            # closes the session, so any later access (outside the block)
            # would trigger a lazy-load on a detached instance and raise
            # DetachedInstanceError.
            flagged = bool(record.flagged)
            trusted = bool(record.trusted_status)
            await session.commit()

        return ResaleCheckResponse(
            flagged=flagged,
            requiresAdditionalVerification=flagged and not trusted,
            trusted=trusted,
            requestsInWindow=count,
        )

    # ------------------------------------------------------------------
    # DELETE /v1/user-data: GDPR/CCPA data deletion endpoint (Task 22.2)
    # ------------------------------------------------------------------

    class DeleteUserDataRequest(BaseModel):
        walletAddress: str

    class DeleteUserDataResponse(BaseModel):
        deleted: bool
        tables: dict

    @app.delete(
        "/v1/user-data",
        response_model=DeleteUserDataResponse,
        status_code=status.HTTP_200_OK,
        summary="Delete all data for the given wallet address",
        dependencies=[Depends(rate_limit_dependency)],
    )
    async def delete_user_data(
        request: Request,
        body: DeleteUserDataRequest,
        api_key: str = Depends(require_api_key),
    ) -> DeleteUserDataResponse:
        from shared.utils.crypto import hash_wallet_address as _hw

        user_hash = _hw(body.walletAddress)
        tables_deleted: dict[str, int] = {}

        async with request.app.state.session_factory() as session:
            # VerificationTokenModel also stores user_hash and must be wiped
            # to satisfy the GDPR/CCPA "delete every row tied to this wallet"
            # contract. Importing locally keeps the top-of-file imports lean.
            from shared.db.models import VerificationTokenModel as _VTM

            # Delete order matters: risk_scores.behavioral_data_id has a FK
            # to behavioral_data.id with no ON DELETE action, so deleting
            # behavioral_data first raises ForeignKeyViolation. Wipe child
            # tables (risk_scores) before parents (behavioral_data).
            for model in (
                RiskScoreModel,
                BehavioralDataModel,
                ChallengeStateModel,
                UserReputationModel,
                _VTM,
            ):
                stmt = _sql_delete(model).where(model.user_hash == user_hash)
                result = await session.execute(stmt)
                tables_deleted[model.__tablename__] = int(result.rowcount or 0)

            await record_access(
                session,
                accessor=hash_api_key(api_key),
                operation_type="DELETE",
                resource_type="user_data",
                resource_id=user_hash,
                details={"tables": tables_deleted},
            )
            await session.commit()

        return DeleteUserDataResponse(deleted=True, tables=tables_deleted)

    # ------------------------------------------------------------------
    # GET /metrics: Prometheus scrape endpoint (Task 21.1)
    # ------------------------------------------------------------------

    @app.get("/metrics", include_in_schema=False)
    async def metrics_endpoint(request: Request) -> Response:
        payload, content_type = request.app.state.metrics.render()
        return Response(content=payload, media_type=content_type)

    return app


# ---------------------------------------------------------------------------
# Helper: build DetectionHandler from app state
# ---------------------------------------------------------------------------


def _build_handler(request: Request, session) -> DetectionHandler:
    """
    Construct a DetectionHandler with all dependencies from app state.

    Args:
        request: The current FastAPI request (provides app.state).
        session: An active AsyncSession for this request.

    Returns:
        A fully wired DetectionHandler instance.
    """
    redis_client = request.app.state.redis
    http_client = request.app.state.http_client

    behavioral_repo = BehavioralDataRepository(session)
    risk_score_repo = RiskScoreRepository(session)
    token_repo = VerificationTokenRepository(session)
    reputation_repo = UserReputationRepository(session)

    ml_client = MLInferenceClient(http_client=http_client, repository=risk_score_repo)
    reputation_service = ReputationService(
        repo=reputation_repo, redis_client=redis_client
    )
    risk_scorer = RiskScorer(
        ml_client=ml_client, reputation_service=reputation_service
    )
    analyzer = BehavioralAnalyzer()

    return DetectionHandler(
        analyzer=analyzer,
        risk_scorer=risk_scorer,
        behavioral_repo=behavioral_repo,
        risk_score_repo=risk_score_repo,
        token_repo=token_repo,
        redis_client=redis_client,
    )


async def _handle_with_fallback(
    request: Request,
    body: DetectionRequest,
    original_exc: Exception,
    cid: str,
) -> DetectionResponse:
    """
    Fallback handler when the primary detection pipeline fails.

    Uses rule-based scoring (conservative: challenge at 40) when the ML
    service or database is unavailable.

    Requirements: 10.1
    """
    from shared.models.types import DetectionResponseDecision
    from shared.config import settings

    logger.warning(
        "detection_fallback",
        message="Primary detection pipeline failed; using rule-based fallback",
        error=str(original_exc),
        correlation_id=cid,
    )

    # Conservative fallback: challenge all requests when ML is unavailable
    fallback_score = settings.ML_FALLBACK_DEFAULT_SCORE

    if fallback_score >= settings.RISK_THRESHOLD_BLOCK:
        decision = DetectionResponseDecision.block
    elif fallback_score >= settings.RISK_THRESHOLD_CHALLENGE:
        decision = DetectionResponseDecision.challenge
    else:
        decision = DetectionResponseDecision.allow

    from shared.models.types import ChallengeType
    from shared.utils.time_utils import current_timestamp as _current_timestamp
    import uuid as _uuid

    if decision == DetectionResponseDecision.challenge:
        challenge_id = str(_uuid.uuid4())
        try:
            redis_key = f"challenge:{challenge_id}"
            import json as _json
            await request.app.state.redis.setex(
                redis_key,
                300,
                _json.dumps({
                    "challenge_id": challenge_id,
                    "challenge_type": ChallengeType.image_selection.value,
                    "session_id": body.behavioralData.sessionId,
                    "user_hash": "",
                    # Persist the originating wallet + event so the challenge
                    # service can bind the issued verification token to them
                    # when the user solves the challenge. Without these the
                    # challenge service raises HTTP 422 CHALLENGE_CONTEXT_MISSING.
                    "wallet_address": body.behavioralData.walletAddress,
                    "event_id": getattr(body.context, "eventId", None) if body.context else None,
                    "attempts": 0,
                    "status": "pending",
                    # Mirrors the SETEX TTL above. Without this the challenge
                    # service crashes with KeyError on validate_challenge and
                    # the user can never complete the verification flow.
                    "expires_at": _current_timestamp() + 300,
                }),
            )
        except Exception as redis_exc:
            logger.error(
                "fallback_redis_write_error",
                message="Failed to store fallback challenge state in Redis",
                challenge_id=challenge_id,
                session_id=body.behavioralData.sessionId,
                error=str(redis_exc),
                exc_info=True,
            )
            # Do not return a challenge_id that was never persisted — the
            # client would receive an ID it can never resolve.
            return DetectionResponse(
                decision=DetectionResponseDecision.block,
                riskScore=fallback_score,
            )

        return DetectionResponse(
            decision=decision,
            riskScore=fallback_score,
            challengeId=challenge_id,
            challengeType=ChallengeType.image_selection,
        )

    return DetectionResponse(
        decision=decision,
        riskScore=fallback_score,
    )


# ---------------------------------------------------------------------------
# Application instance
# ---------------------------------------------------------------------------

app = create_app()
