"""
Testing mode helpers (Task 25.1, 25.3).

Provides:
- ``extract_test_run_id`` for reading the ``X-Test-Mode`` / ``X-Test-Run-Id``
  headers.
- ``test_redis_key`` to namespace Redis keys under ``test:{run_id}:``.
- ``SyntheticTrafficGenerator`` with configurable mix of bot/human
  behavioural patterns (Task 25.2).
- ``ScenarioReplay`` helper that records + replays detection scenarios.

Requirements: 12.1, 12.2, 12.3, 12.4
"""

from __future__ import annotations

import json
import random
import uuid
from dataclasses import dataclass, field
from typing import List, Mapping, Optional

from .models.types import (
    BehavioralData,
    DetectionRequest,
    EventType,
    KeystrokeEvent,
    MouseEvent,
    NavigationEvent,
    RiskContext,
)

TEST_MODE_HEADER = "X-Test-Mode"
TEST_RUN_HEADER = "X-Test-Run-Id"


def extract_test_run_id(headers: Mapping[str, str]) -> Optional[str]:
    mode = (
        headers.get(TEST_MODE_HEADER)
        or headers.get(TEST_MODE_HEADER.lower())
        or headers.get(TEST_MODE_HEADER.title())
    )
    if not mode or str(mode).lower() not in {"1", "true", "yes"}:
        return None
    run_id = (
        headers.get(TEST_RUN_HEADER)
        or headers.get(TEST_RUN_HEADER.lower())
        or headers.get(TEST_RUN_HEADER.title())
        or f"run-{uuid.uuid4().hex[:8]}"
    )
    return run_id


def test_redis_key(run_id: Optional[str], key: str) -> str:
    return f"test:{run_id}:{key}" if run_id else key


@dataclass
class TrafficMix:
    bot_fraction: float = 0.3
    sessions: int = 10
    events_per_session: int = 40

    def __post_init__(self) -> None:
        if not 0.0 <= self.bot_fraction <= 1.0:
            raise ValueError("bot_fraction must be between 0 and 1")
        if self.sessions <= 0:
            raise ValueError("sessions must be > 0")


class SyntheticTrafficGenerator:
    """Produces BehavioralData payloads with known ground-truth labels."""

    def __init__(self, seed: Optional[int] = None) -> None:
        self.rng = random.Random(seed)

    def generate(self, mix: TrafficMix) -> List[tuple[str, BehavioralData]]:
        payloads: List[tuple[str, BehavioralData]] = []
        bot_sessions = int(mix.sessions * mix.bot_fraction)
        human_sessions = mix.sessions - bot_sessions
        for _ in range(bot_sessions):
            payloads.append(("bot", self._make_bot_session(mix.events_per_session)))
        for _ in range(human_sessions):
            payloads.append(("human", self._make_human_session(mix.events_per_session)))
        self.rng.shuffle(payloads)
        return payloads

    def _make_bot_session(self, n_events: int) -> BehavioralData:
        # Linear motion, constant keystroke cadence, no scrolling variability
        events = []
        t = 0.0
        for i in range(n_events):
            events.append(
                MouseEvent(
                    timestamp=t,
                    type=EventType.mousemove,
                    x=float(i * 10),
                    y=float(i * 10),
                )
            )
            t += 0.05
        for i in range(min(10, n_events // 4)):
            events.append(
                KeystrokeEvent(
                    timestamp=t,
                    type=EventType.keyup,
                    key="A",
                    pressTime=0.05,
                    interKeyInterval=0.1,
                )
            )
            t += 0.1
        return BehavioralData(
            sessionId=f"bot-{uuid.uuid4().hex[:8]}",
            walletAddress=f"0x{'b' * 40}",
            userAgent="curl/8.0",
            ipAddress="10.0.0.1",
            events=events,
        )

    def _make_human_session(self, n_events: int) -> BehavioralData:
        events = []
        t = 0.0
        x, y = 100.0, 100.0
        for i in range(n_events):
            x += self.rng.uniform(-8, 8)
            y += self.rng.uniform(-8, 8)
            x = max(0.0, x)
            y = max(0.0, y)
            events.append(
                MouseEvent(
                    timestamp=t,
                    type=EventType.mousemove,
                    x=x,
                    y=y,
                )
            )
            t += self.rng.uniform(0.02, 0.08)
        for _ in range(min(15, n_events // 3)):
            events.append(
                KeystrokeEvent(
                    timestamp=t,
                    type=EventType.keyup,
                    key=self.rng.choice(["KeyA", "KeyB", "KeyC", "Space"]),
                    pressTime=self.rng.uniform(0.05, 0.18),
                    interKeyInterval=self.rng.uniform(0.1, 0.45),
                )
            )
            t += self.rng.uniform(0.2, 0.6)
        events.append(
            NavigationEvent(
                timestamp=t,
                type=EventType.navigation,
                fromPage="/",
                toPage="/event/123",
                dwellTime=self.rng.uniform(3.0, 25.0),
            )
        )
        return BehavioralData(
            sessionId=f"human-{uuid.uuid4().hex[:8]}",
            walletAddress=f"0x{'a' * 40}",
            userAgent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/124",
            ipAddress="10.0.0.2",
            events=events,
        )


@dataclass
class RecordedScenario:
    scenario_id: str
    request: DetectionRequest
    response: dict
    tags: List[str] = field(default_factory=list)

    def to_json(self) -> str:
        return json.dumps(
            {
                "scenario_id": self.scenario_id,
                "request": self.request.model_dump(),
                "response": self.response,
                "tags": self.tags,
            }
        )

    @classmethod
    def from_json(cls, text: str) -> "RecordedScenario":
        data = json.loads(text)
        return cls(
            scenario_id=data["scenario_id"],
            request=DetectionRequest(**data["request"]),
            response=data["response"],
            tags=data.get("tags", []),
        )


class ScenarioReplay:
    """In-memory scenario store used by the ``/v1/replay`` endpoint."""

    def __init__(self) -> None:
        self._store: dict[str, RecordedScenario] = {}

    def record(
        self,
        request: DetectionRequest,
        response: dict,
        tags: Optional[List[str]] = None,
    ) -> RecordedScenario:
        scenario = RecordedScenario(
            scenario_id=f"scn-{uuid.uuid4().hex[:12]}",
            request=request,
            response=response,
            tags=list(tags or []),
        )
        self._store[scenario.scenario_id] = scenario
        return scenario

    def get(self, scenario_id: str) -> Optional[RecordedScenario]:
        return self._store.get(scenario_id)

    def delete(self, scenario_id: str) -> bool:
        return self._store.pop(scenario_id, None) is not None

    def list_ids(self) -> List[str]:
        return list(self._store.keys())


__all__ = [
    "TEST_MODE_HEADER",
    "TEST_RUN_HEADER",
    "extract_test_run_id",
    "test_redis_key",
    "SyntheticTrafficGenerator",
    "TrafficMix",
    "ScenarioReplay",
    "RecordedScenario",
]
