"""Smoke tests for the AI Insights service.

These run without any heavy ML dependencies — they exercise the API contract
and the deterministic heuristic fallbacks.
"""

import pytest
from fastapi.testclient import TestClient

from ai_insights.app import create_app
from ai_insights.config import settings

DEV_KEY = settings.DEV_API_KEY
AUTH = {"X-API-Key": DEV_KEY}


@pytest.fixture(scope="module")
def client():
    app = create_app()
    with TestClient(app) as c:
        yield c


def test_health_no_auth(client):
    resp = client.get("/health")
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "ok"
    assert "forecast" in body and "rag" in body


def test_forecast_requires_api_key(client):
    resp = client.post("/v1/forecast/resale-price", json={"eventId": "EVT_048", "originalPrice": 100})
    assert resp.status_code == 401


def test_forecast_invalid_key(client):
    resp = client.post(
        "/v1/forecast/resale-price",
        json={"eventId": "EVT_048", "originalPrice": 100},
        headers={"X-API-Key": "wrong"},
    )
    assert resp.status_code == 403


def test_resale_price_band(client):
    resp = client.post(
        "/v1/forecast/resale-price",
        json={"eventId": "EVT_048", "originalPrice": 100.0},
        headers=AUTH,
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["currency"] == "cUSD"
    assert body["low"] <= body["suggestedPrice"] <= body["high"]
    assert body["suggestedPrice"] >= body["originalPrice"]  # never below face value
    assert 0.0 <= body["confidence"] <= 1.0


def test_demand_trend(client):
    resp = client.post(
        "/v1/forecast/demand",
        json={"eventId": "EVT_048", "horizonDays": 5},
        headers=AUTH,
    )
    assert resp.status_code == 200
    body = resp.json()
    assert len(body["points"]) == 5
    assert body["trend"] in {"up", "flat", "down"}


def test_ask_returns_answer(client):
    resp = client.post("/v1/ask", json={"question": "How does resale work on Rexell?"}, headers=AUTH)
    assert resp.status_code == 200
    body = resp.json()
    assert isinstance(body["answer"], str) and body["answer"]
    assert body["mode"] in {"llm", "extractive", "no_context", "empty"}
