"""
ML Inference Service (Task 19.1).

A minimal FastAPI wrapper that loads the latest bot-detection and scalper-intent
models from MinIO (or a local path) at startup and exposes ``POST /predictions``
for dual-head online scoring. Feature vectors are normalized to [0, 1] before
inference.

Returns both ``bot_probability`` and ``scalper_probability``.

Requirements: 3.4
"""

from __future__ import annotations

import logging
import os
import tempfile
from contextlib import asynccontextmanager
from typing import Dict, List, Optional, Any

from fastapi import FastAPI, HTTPException, Request

logger = logging.getLogger(__name__)


FEATURE_COLUMNS = [
    "mouse_velocity_mean",
    "mouse_velocity_std",
    "mouse_acceleration",
    "mouse_curvature",
    "click_frequency",
    "flight_time_mean",
    "flight_time_std",
    "dwell_time_mean",
    "navigation_entropy",
    "page_dwell_time_dist",
]

FEATURE_UPPER_BOUNDS: Dict[str, float] = {
    "mouse_velocity_mean": 5000.0,
    "mouse_velocity_std": 5000.0,
    "mouse_acceleration": 50000.0,
    "mouse_curvature": 1.0,
    "click_frequency": 10.0,
    "flight_time_mean": 2000.0,
    "flight_time_std": 2000.0,
    "dwell_time_mean": 2000.0,
    "navigation_entropy": 5.0,
    "page_dwell_time_dist": 1.0,
}


def _normalize(features: Dict[str, float]) -> List[float]:
    row: List[float] = []
    for col in FEATURE_COLUMNS:
        value = float(features.get(col, 0.0))
        upper = FEATURE_UPPER_BOUNDS.get(col, 1.0)
        if upper <= 0:
            upper = 1.0
        row.append(max(0.0, min(1.0, value / upper)))
    return row


def _load_local_model(path: str):
    import joblib

    return joblib.load(path)


def _load_model_from_minio(artifact_name: str = "model.joblib") -> Optional[object]:
    endpoint = os.getenv("MINIO_ENDPOINT")
    bucket = os.getenv("MINIO_MODEL_BUCKET", "bot-detection-models")
    version = os.getenv("MODEL_VERSION")
    if not endpoint or not version:
        return None
    try:
        from minio import Minio  # type: ignore

        client = Minio(
            endpoint,
            access_key=os.getenv("MINIO_ACCESS_KEY", ""),
            secret_key=os.getenv("MINIO_SECRET_KEY", ""),
            secure=os.getenv("MINIO_SECURE", "true").lower() == "true",
        )
        with tempfile.NamedTemporaryFile(suffix=".joblib", delete=False) as fh:
            target = fh.name
        client.fget_object(bucket, f"{version}/{artifact_name}", target)
        return _load_local_model(target)
    except Exception:  # noqa: BLE001
        logger.exception("Failed to load %s from MinIO", artifact_name)
        return None


def _resolve_model_path(base_path: str, preferred: str, fallback: str) -> Optional[str]:
    """Return the first existing model path, preferring the new naming convention."""
    for name in (preferred, fallback):
        candidate = os.path.join(os.path.dirname(base_path), name)
        if os.path.exists(candidate):
            return candidate
    return base_path if os.path.exists(base_path) else None


@asynccontextmanager
async def lifespan(app: FastAPI):
    logging.basicConfig(level=os.getenv("LOG_LEVEL", "INFO"))
    model = None
    scalper_model = None
    local_path = os.getenv("MODEL_PATH")

    # Load bot detection model
    if local_path and os.path.exists(local_path):
        try:
            bot_path = _resolve_model_path(local_path, "bot_model.joblib", "model.joblib")
            if bot_path:
                model = _load_local_model(bot_path)
                logger.info("Loaded bot model from %s", bot_path)
        except Exception:  # noqa: BLE001
            logger.exception("Failed to load local bot model")
    if model is None:
        model = _load_model_from_minio("bot_model.joblib")
    if model is None:
        model = _load_model_from_minio("model.joblib")
    if model is None:
        logger.warning("Inference service started without a bot model (placeholder mode)")

    # Load scalper intent model
    if local_path:
        scalper_path = os.path.join(os.path.dirname(local_path), "scalper_model.joblib")
        if os.path.exists(scalper_path):
            try:
                scalper_model = _load_local_model(scalper_path)
                logger.info("Loaded scalper model from %s", scalper_path)
            except Exception:  # noqa: BLE001
                logger.exception("Failed to load local scalper model")
    if scalper_model is None:
        scalper_model = _load_model_from_minio("scalper_model.joblib")
    if scalper_model is None:
        logger.warning("Scalper model not found; scalper_probability will default to 0.0")

    app.state.model = model
    app.state.scalper_model = scalper_model
    app.state.model_version = os.getenv("MODEL_VERSION", "unknown")
    yield


app = FastAPI(
    title="Rexell Bot Detection — ML Inference",
    version="1.0.0",
    lifespan=lifespan,
)


@app.get("/ping", include_in_schema=False)
async def ping() -> Dict[str, str]:
    return {"status": "ok"}


@app.get("/v1/health")
async def health(request: Request) -> Dict[str, object]:
    bot_loaded = request.app.state.model is not None
    scalper_loaded = request.app.state.scalper_model is not None
    return {
        "status": "healthy" if bot_loaded else "degraded",
        "bot_model_loaded": bot_loaded,
        "scalper_model_loaded": scalper_loaded,
        "model_version": request.app.state.model_version,
    }


@app.post("/predictions")
async def predict(request: Request, payload: Dict[str, Any]) -> Dict[str, object]:
    model = request.app.state.model
    scalper_model = request.app.state.scalper_model
    features = payload.get("features", payload)
    row = _normalize(features)

    # Bot head inference
    if model is None:
        bot_score = sum(row) / len(row)
    else:
        try:
            import numpy as np  # type: ignore

            proba = model.predict_proba(np.asarray([row]))[0][1]
            bot_score = float(proba)
        except Exception as exc:  # noqa: BLE001
            logger.exception("Bot model inference failed")
            raise HTTPException(status_code=500, detail=str(exc))

    # Scalper head inference
    scalper_score = 0.0
    if scalper_model is not None:
        try:
            import numpy as np  # type: ignore

            s_proba = scalper_model.predict_proba(np.asarray([row]))[0][1]
            scalper_score = float(s_proba)
        except Exception:  # noqa: BLE001
            logger.warning("Scalper model inference failed; defaulting to 0.0")

    return {
        "bot_probability": float(max(0.0, min(1.0, bot_score))),
        "scalper_probability": float(max(0.0, min(1.0, scalper_score))),
        "model_version": request.app.state.model_version,
    }
