"""FastAPI application for the Rexell AI Insights service.

Exposes:
- GET  /health                       — liveness + model status (no auth)
- POST /v1/forecast/resale-price      — suggested resale price band (auth)
- POST /v1/forecast/demand            — demand trend over a horizon (auth)
- POST /v1/ask                        — Rexell knowledge assistant (auth)

Auth via X-API-Key (see auth.py). Heavy ML models load lazily at startup and
degrade to deterministic heuristics so the service always stays up.
"""

import os
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from .auth import require_api_key
from .config import settings
from .forecast.model import ForecastEngine
from .logger import configure_logging, get_logger, set_correlation_id
from .rag.qa import RAGEngine

logger = get_logger(__name__)


# ---------------------------------------------------------------------------
# Request models
# ---------------------------------------------------------------------------
class ResalePriceRequest(BaseModel):
    eventId: str = Field(..., description="Event identifier, e.g. EVT_048")
    originalPrice: float = Field(..., gt=0, description="Face value in cUSD")


class DemandRequest(BaseModel):
    eventId: str
    horizonDays: int = Field(7, ge=1, le=30)


class AskRequest(BaseModel):
    question: str
    context: str | None = None


# ---------------------------------------------------------------------------
# Lifespan
# ---------------------------------------------------------------------------
@asynccontextmanager
async def lifespan(app: FastAPI):
    configure_logging(settings.LOG_LEVEL)
    logger.info("AI Insights service starting", evt="startup")

    forecast = ForecastEngine()
    forecast.load()
    app.state.forecast = forecast

    rag = RAGEngine()
    rag.load()
    app.state.rag = rag

    logger.info(
        "AI Insights service ready",
        evt="startup_complete",
        forecast=forecast.status,
        rag=rag.status,
    )
    yield
    logger.info("AI Insights service shutting down", evt="shutdown")


# ---------------------------------------------------------------------------
# App factory
# ---------------------------------------------------------------------------
def create_app() -> FastAPI:
    app = FastAPI(
        title="Rexell AI Insights Service",
        version="0.1.0",
        description="Resale-price forecasting and knowledge assistant for Rexell",
        lifespan=lifespan,
    )

    allowed = os.getenv("AI_INSIGHTS_CORS_ORIGINS", "*")
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[o.strip() for o in allowed.split(",")] if allowed != "*" else ["*"],
        allow_methods=["GET", "POST"],
        allow_headers=["*"],
    )

    @app.middleware("http")
    async def correlation_id_middleware(request: Request, call_next):
        cid = request.headers.get("X-Correlation-ID")
        set_correlation_id(cid)
        response = await call_next(request)
        response.headers["X-Correlation-ID"] = (cid or "") or response.headers.get("X-Correlation-ID", "")
        return response

    # ---- Health (no auth) ------------------------------------------------
    @app.get("/health")
    async def health(request: Request):
        return {
            "status": "ok",
            "service": "ai-insights",
            "forecast": request.app.state.forecast.status,
            "rag": request.app.state.rag.status,
        }

    # ---- Forecast --------------------------------------------------------
    @app.post("/v1/forecast/resale-price")
    async def resale_price(
        body: ResalePriceRequest,
        request: Request,
        _key: str = Depends(require_api_key),
    ):
        result = request.app.state.forecast.predict_resale_price(body.eventId, body.originalPrice)
        return result

    @app.post("/v1/forecast/demand")
    async def demand(
        body: DemandRequest,
        request: Request,
        _key: str = Depends(require_api_key),
    ):
        return request.app.state.forecast.predict_demand(body.eventId, body.horizonDays)

    # ---- Assistant -------------------------------------------------------
    @app.post("/v1/ask")
    async def ask(
        body: AskRequest,
        request: Request,
        _key: str = Depends(require_api_key),
    ):
        return request.app.state.rag.ask(body.question)

    # ---- Error handler ---------------------------------------------------
    @app.exception_handler(Exception)
    async def unhandled_exception_handler(request: Request, exc: Exception):  # noqa: ARG001
        logger.error("Unhandled error", evt="unhandled_error", error=str(exc))
        return JSONResponse(
            status_code=500,
            content={"error_code": "INTERNAL_ERROR", "message": "An internal error occurred"},
        )

    return app


app = create_app()
