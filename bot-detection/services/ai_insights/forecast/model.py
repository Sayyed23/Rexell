"""Inference engine for resale-price / demand forecasting.

Loads the trained LSTM (Keras) plus a JSON min/max scaler and per-event
statistics. TensorFlow is imported lazily; if the model or library is
unavailable the engine transparently falls back to a deterministic,
data-driven heuristic so the API never fails closed.
"""

import json
from pathlib import Path
from typing import List, Optional

from ..config import settings
from ..logger import get_logger
from .features import WINDOW

logger = get_logger(__name__)


class ForecastEngine:
    def __init__(self) -> None:
        self._model = None
        self._scaler: Optional[dict] = None
        self._event_stats: dict = {}
        self._global: dict = {"median_markup": 1.0, "median_resale_markup": 1.0, "avg_daily_demand": 1.0}
        self._model_loaded = False

    # ------------------------------------------------------------------
    # Loading
    # ------------------------------------------------------------------
    def load(self) -> None:
        """Attempt to load model + scaler + stats. Never raises."""
        model_dir = settings.MODEL_DIR
        self._load_stats(model_dir)
        self._load_scaler(model_dir)
        self._load_model(model_dir)

    def _load_stats(self, model_dir: Path) -> None:
        path = model_dir / settings.EVENT_STATS_FILE
        try:
            with open(path) as fh:
                blob = json.load(fh)
            self._event_stats = blob.get("events", {})
            self._global = blob.get("global", self._global)
            logger.info("Loaded event stats", evt="stats_loaded", events=len(self._event_stats))
        except FileNotFoundError:
            logger.warning("Event stats not found; using neutral defaults", evt="stats_missing")
        except Exception as exc:  # noqa: BLE001
            logger.warning("Failed to load event stats", evt="stats_error", error=str(exc))

    def _load_scaler(self, model_dir: Path) -> None:
        path = model_dir / settings.SCALER_FILE
        try:
            with open(path) as fh:
                self._scaler = json.load(fh)
        except FileNotFoundError:
            self._scaler = None
        except Exception as exc:  # noqa: BLE001
            logger.warning("Failed to load scaler", evt="scaler_error", error=str(exc))
            self._scaler = None

    def _load_model(self, model_dir: Path) -> None:
        path = model_dir / settings.LSTM_MODEL_FILE
        if not path.exists() or self._scaler is None:
            logger.warning("LSTM model unavailable; heuristic fallback active", evt="model_missing")
            return
        try:
            import tensorflow as tf  # lazy, heavy

            self._model = tf.keras.models.load_model(str(path))
            self._model_loaded = True
            logger.info("Loaded LSTM forecast model", evt="model_loaded")
        except Exception as exc:  # noqa: BLE001
            logger.warning("Failed to load LSTM; heuristic fallback active", evt="model_load_error", error=str(exc))
            self._model = None
            self._model_loaded = False

    # ------------------------------------------------------------------
    # Scaling helpers
    # ------------------------------------------------------------------
    def _scale(self, values: List[float]) -> List[float]:
        lo = self._scaler["min"]
        hi = self._scaler["max"]
        span = (hi - lo) or 1.0
        return [min(max((v - lo) / span, 0.0), 1.0) for v in values]

    def _unscale(self, value: float) -> float:
        lo = self._scaler["min"]
        hi = self._scaler["max"]
        return value * ((hi - lo) or 1.0) + lo

    # ------------------------------------------------------------------
    # Prediction
    # ------------------------------------------------------------------
    def _predict_ratio(self, window: List[float]) -> Optional[float]:
        """Run the LSTM on a window of markup ratios -> next ratio."""
        if not self._model_loaded or self._model is None or self._scaler is None:
            return None
        if len(window) < WINDOW:
            # left-pad with the first value
            window = [window[0]] * (WINDOW - len(window)) + window if window else None
        if not window:
            return None
        try:
            import numpy as np

            scaled = self._scale(window[-WINDOW:])
            x = np.array(scaled, dtype="float32").reshape(1, WINDOW, 1)
            pred_scaled = float(self._model.predict(x, verbose=0)[0][0])
            return self._unscale(pred_scaled)
        except Exception as exc:  # noqa: BLE001
            logger.warning("LSTM inference failed; falling back", evt="inference_error", error=str(exc))
            return None

    def predict_resale_price(self, event_id: str, original_price: float) -> dict:
        ev = self._event_stats.get(event_id, {})
        window = ev.get("last_window") or []

        predicted_ratio = self._predict_ratio(window)
        basis = "lstm"
        if predicted_ratio is None:
            predicted_ratio = ev.get("median_resale_markup") or self._global.get("median_resale_markup", 1.0)
            basis = "heuristic_event" if ev else "heuristic_global"

        # Clamp to a sane resale band (never below face value, cap runaway markup)
        predicted_ratio = max(1.0, min(predicted_ratio, 3.0))
        suggested = round(original_price * predicted_ratio, 2)
        low = round(original_price * max(1.0, predicted_ratio * 0.92), 2)
        high = round(original_price * min(3.0, predicted_ratio * 1.08), 2)

        sample = int(ev.get("count", 0))
        confidence = round(min(0.95, 0.4 + sample / 200.0 + (0.2 if basis == "lstm" else 0.0)), 2)

        return {
            "eventId": event_id,
            "currency": "cUSD",
            "originalPrice": round(original_price, 2),
            "suggestedPrice": suggested,
            "low": low,
            "high": high,
            "expectedMarkupPct": round((predicted_ratio - 1.0) * 100.0, 2),
            "confidence": confidence,
            "basis": basis,
            "sampleSize": sample,
        }

    def predict_demand(self, event_id: str, horizon_days: int = 7) -> dict:
        ev = self._event_stats.get(event_id, {})
        avg = ev.get("avg_daily_demand") or self._global.get("avg_daily_demand", 1.0)
        basis = "heuristic_event" if ev else "heuristic_global"

        # Simple demand curve: mild decay over the horizon (secondary interest cools)
        points = []
        for d in range(1, max(1, horizon_days) + 1):
            factor = max(0.4, 1.0 - 0.05 * (d - 1))
            points.append({"day": d, "expectedSales": round(avg * factor, 2)})

        first = points[0]["expectedSales"]
        last = points[-1]["expectedSales"]
        trend = "down" if last < first * 0.95 else ("up" if last > first * 1.05 else "flat")
        return {
            "eventId": event_id,
            "horizonDays": horizon_days,
            "avgDailyDemand": round(avg, 2),
            "points": points,
            "trend": trend,
            "basis": basis,
        }

    @property
    def status(self) -> dict:
        return {
            "model_loaded": self._model_loaded,
            "scaler_loaded": self._scaler is not None,
            "events_known": len(self._event_stats),
        }
