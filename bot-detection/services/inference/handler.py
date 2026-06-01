"""
ML Inference Service (Task 19.1).

A minimal FastAPI wrapper that loads the latest bot-detection model from
MinIO (or a local path) at startup and exposes ``POST /predictions`` for
online scoring. Feature vectors are normalized to [0, 1] before inference.

Requirements: 3.4
"""

from __future__ import annotations

import logging
import os
import tempfile
from contextlib import asynccontextmanager
from typing import Dict, List, Optional

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


def _load_model_from_minio() -> Optional[object]:
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
        client.fget_object(bucket, f"{version}/model.joblib", target)
        return _load_local_model(target)
    except Exception:  # noqa: BLE001
        logger.exception("Failed to load model from MinIO")
        return None


@asynccontextmanager
async def lifespan(app: FastAPI):
    logging.basicConfig(level=os.getenv("LOG_LEVEL", "INFO"))
    model = None
    local_path = os.getenv("MODEL_PATH")
    if local_path and os.path.exists(local_path):
        try:
            model = _load_local_model(local_path)
            logger.info("Loaded model from %s", local_path)
        except Exception:  # noqa: BLE001
            logger.exception("Failed to load local model")
    if model is None:
        model = _load_model_from_minio()
    if model is None:
        logger.warning("Inference service started without a model (placeholder mode)")
    app.state.model = model
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
    loaded = request.app.state.model is not None
    return {
        "status": "healthy" if loaded else "degraded",
        "model_loaded": loaded,
        "model_version": request.app.state.model_version,
    }


@app.post("/predictions")
async def predict(request: Request, payload: Dict[str, float]) -> Dict[str, object]:
    model = request.app.state.model
    row = _normalize(payload)
    if model is None:
        # Placeholder scoring: average feature magnitude
        score = sum(row) / len(row)
    else:
        try:
            import numpy as np  # type: ignore

            proba = model.predict_proba(np.asarray([row]))[0][1]
            score = float(proba)
        except Exception as exc:  # noqa: BLE001
            logger.exception("Model inference failed")
            raise HTTPException(status_code=500, detail=str(exc))
    return {
        "bot_probability": float(max(0.0, min(1.0, score))),
        "model_version": request.app.state.model_version,
    }
