"""
A/B testing router for model updates (Task 19.3).

Routes a configurable fraction of inference traffic to a new model version.
When the new model's accuracy is measured to drop more than 5% below the
incumbent for a 48h window the traffic weight is reset to 0 — an automatic
rollback.
"""

from __future__ import annotations

import random
import time
from dataclasses import dataclass
from typing import Optional


@dataclass
class ModelVariant:
    version: str
    weight: float  # 0..1
    accuracy: Optional[float] = None
    last_measured_at: Optional[float] = None


class ABRouter:
    def __init__(
        self,
        control: ModelVariant,
        candidate: Optional[ModelVariant] = None,
        rollback_degradation: float = 0.05,
        monitoring_window_seconds: int = 48 * 3600,
    ) -> None:
        self.control = control
        self.candidate = candidate
        self.rollback_degradation = rollback_degradation
        self.monitoring_window_seconds = monitoring_window_seconds
        self._started_at = time.time()

    def choose_version(self, rng: Optional[random.Random] = None) -> str:
        if self.candidate is None or self.candidate.weight <= 0:
            return self.control.version
        rng = rng or random
        return (
            self.candidate.version
            if rng.random() < self.candidate.weight
            else self.control.version
        )

    def record_accuracy(self, version: str, accuracy: float) -> None:
        now = time.time()
        if self.candidate and version == self.candidate.version:
            self.candidate.accuracy = accuracy
            self.candidate.last_measured_at = now
        if version == self.control.version:
            self.control.accuracy = accuracy
            self.control.last_measured_at = now

    def should_rollback(self) -> bool:
        if self.candidate is None or self.control.accuracy is None or self.candidate.accuracy is None:
            return False
        elapsed = time.time() - self._started_at
        if elapsed < self.monitoring_window_seconds:
            return False
        degraded = self.control.accuracy - self.candidate.accuracy
        return degraded > self.rollback_degradation

    def rollback(self) -> None:
        if self.candidate is not None:
            self.candidate.weight = 0.0
