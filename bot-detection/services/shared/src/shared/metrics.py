"""
Prometheus metrics for the Rexell bot-detection services (Task 21.1, 21.5).

``prometheus_client`` is an optional dependency — when it is missing the
module exposes no-op stubs so that unit tests can import this file without
requiring the library.

Requirements: 8.2, 8.3, 8.4, 8.5
"""

from __future__ import annotations

import logging
from contextlib import contextmanager
from typing import Any, Iterator

logger = logging.getLogger(__name__)

try:
    from prometheus_client import (
        CONTENT_TYPE_LATEST,
        CollectorRegistry,
        Counter,
        Gauge,
        Histogram,
        generate_latest,
    )

    _PROM_AVAILABLE = True
except Exception:  # noqa: BLE001
    _PROM_AVAILABLE = False

    class _Stub:
        def __init__(self, *_a: Any, **_kw: Any) -> None:
            pass

        def labels(self, *_a: Any, **_kw: Any) -> "_Stub":
            return self

        def inc(self, *_a: Any, **_kw: Any) -> None:
            pass

        def observe(self, *_a: Any, **_kw: Any) -> None:
            pass

        def set(self, *_a: Any, **_kw: Any) -> None:
            pass

    CollectorRegistry = _Stub  # type: ignore
    Counter = _Stub  # type: ignore
    Gauge = _Stub  # type: ignore
    Histogram = _Stub  # type: ignore
    CONTENT_TYPE_LATEST = "text/plain"  # type: ignore

    def generate_latest(_registry: Any = None) -> bytes:  # type: ignore
        return b""


_BUCKETS = (0.005, 0.01, 0.025, 0.05, 0.1, 0.2, 0.3, 0.5, 1.0, 2.5, 5.0)


class BotDetectionMetrics:
    """Service-wide Prometheus metrics for Detection & Challenge services."""

    def __init__(self, registry: Any = None) -> None:
        self.registry = registry or CollectorRegistry()

        self.requests_total = Counter(
            "bot_detection_requests_total",
            "Total bot-detection requests grouped by decision",
            ("decision",),
            registry=self.registry,
        )
        self.errors_total = Counter(
            "bot_detection_errors_total",
            "Total bot-detection request errors grouped by category",
            ("category",),
            registry=self.registry,
        )
        self.latency_seconds = Histogram(
            "bot_detection_latency_seconds",
            "End-to-end bot detection latency",
            ("endpoint",),
            buckets=_BUCKETS,
            registry=self.registry,
        )
        self.risk_score_histogram = Histogram(
            "bot_detection_risk_score_histogram",
            "Distribution of computed risk scores",
            buckets=tuple(range(0, 101, 5)),
            registry=self.registry,
        )
        self.challenge_completion_rate = Gauge(
            "challenge_completion_rate",
            "Rolling ratio of successful challenge completions",
            registry=self.registry,
        )
        self.fallback_mode_active = Gauge(
            "fallback_mode_active",
            "1 if fallback mode is active, 0 otherwise",
            registry=self.registry,
        )
        self.ml_inference_latency_seconds = Histogram(
            "ml_inference_latency_seconds",
            "Latency of ML inference calls",
            buckets=_BUCKETS,
            registry=self.registry,
        )
        self.model_accuracy = Gauge(
            "bot_detection_model_accuracy",
            "Most recent measured model accuracy",
            ("model_version",),
            registry=self.registry,
        )

    @contextmanager
    def observe_latency(self, endpoint: str) -> Iterator[None]:
        import time

        start = time.perf_counter()
        try:
            yield
        finally:
            self.latency_seconds.labels(endpoint=endpoint).observe(
                time.perf_counter() - start
            )

    def record_decision(self, decision: str, risk_score: float) -> None:
        self.requests_total.labels(decision=decision).inc()
        self.risk_score_histogram.observe(risk_score)

    def record_error(self, category: str) -> None:
        self.errors_total.labels(category=category).inc()

    def set_fallback(self, active: bool) -> None:
        self.fallback_mode_active.set(1.0 if active else 0.0)

    def set_model_accuracy(self, model_version: str, accuracy: float) -> None:
        self.model_accuracy.labels(model_version=model_version).set(accuracy)

    def render(self) -> tuple[bytes, str]:
        return generate_latest(self.registry), CONTENT_TYPE_LATEST


_default: BotDetectionMetrics | None = None


def get_metrics() -> BotDetectionMetrics:
    global _default
    if _default is None:
        _default = BotDetectionMetrics()
    return _default


__all__ = ["BotDetectionMetrics", "get_metrics", "CONTENT_TYPE_LATEST"]
