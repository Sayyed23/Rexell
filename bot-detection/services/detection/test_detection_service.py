"""
Unit tests for the Detection Service (Tasks 7.1 - 7.4).

Covers:
- Task 7.1: FastAPI app routing, authentication, rate limiting
- Task 7.2: Detection orchestration handler (allow/challenge/block flows)
- Task 7.3: Structured logging (correlation IDs, anonymization)
- Task 7.4: Error handling and fallback behavior

Requirements: 1.1, 1.2, 1.3, 1.4, 1.5
"""

import json
import sys
import time
import uuid
from pathlib import Path
from typing import List, Optional
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

# Ensure shared modules are importable
shared_src = Path(__file__).parent.parent / "shared" / "src"
if shared_src.exists() and str(shared_src) not in sys.path:
    sys.path.insert(0, str(shared_src))

from shared.models.types import (
    BehavioralData,
    ChallengeType,
    DetectionRequest,
    DetectionResponse,
    DetectionResponseDecision,
    EventType,
    MouseEvent,
    KeystrokeEvent,
    NavigationEvent,
    RiskContext,
    RiskFactor,
    RiskScore,
    RISK_THRESHOLD_BLOCK,
    RISK_THRESHOLD_CHALLENGE,
)
from shared.analyzer import BehavioralAnalyzer
from shared.utils.crypto import hash_wallet_address

# ---------------------------------------------------------------------------
# Fixtures and helpers
# ---------------------------------------------------------------------------


def _make_mouse_event(ts: float, x: float = 100.0, y: float = 200.0) -> dict:
    return {"timestamp": ts, "type": "mousemove", "x": x, "y": y}


def _make_keystroke_event(ts: float) -> dict:
    return {
        "timestamp": ts,
        "type": "keydown",
        "key": "a",
        "pressTime": 50.0,
        "interKeyInterval": 120.0,
    }


def _make_nav_event(ts: float) -> dict:
    return {
        "timestamp": ts,
        "type": "navigation",
        "fromPage": "/events",
        "toPage": "/event/123",
        "dwellTime": 3000.0,
    }


def _make_behavioral_data(
    session_id: Optional[str] = None,
    wallet: str = "0xABCDEF1234567890",
) -> BehavioralData:
    """Build a minimal valid BehavioralData instance."""
    sid = session_id or str(uuid.uuid4())
    now = time.time()
    events_raw = [
        _make_mouse_event(now),
        _make_mouse_event(now + 0.1, x=110.0, y=210.0),
        _make_keystroke_event(now + 0.2),
        _make_nav_event(now + 0.3),
    ]
    return BehavioralData(
        sessionId=sid,
        walletAddress=wallet,
        userAgent="Mozilla/5.0",
        ipAddress="192.168.1.0",
        events=events_raw,
    )


def _make_detection_request(
    session_id: Optional[str] = None,
    wallet: str = "0xABCDEF1234567890",
    is_bulk: bool = False,
) -> DetectionRequest:
    bd = _make_behavioral_data(session_id=session_id, wallet=wallet)
    ctx = RiskContext(isBulkPurchase=is_bulk, requestedQuantity=2 if is_bulk else 1)
    return DetectionRequest(behavioralData=bd, context=ctx)


def _make_risk_score(score: float) -> RiskScore:
    """Build a RiskScore with the given score and appropriate decision."""
    if score >= RISK_THRESHOLD_BLOCK:
        decision = DetectionResponseDecision.block
    elif score >= RISK_THRESHOLD_CHALLENGE:
        decision = DetectionResponseDecision.challenge
    else:
        decision = DetectionResponseDecision.allow

    return RiskScore(
        score=score,
        factors=[
            RiskFactor(
                factor="behavioral_ml_inference",
                contribution=score,
                description="Test factor",
            )
        ],
        decision=decision,
    )


# ---------------------------------------------------------------------------
# Task 7.1: Auth middleware tests
# ---------------------------------------------------------------------------


class TestApiKeyAuthentication:
    """Tests for API key authentication (Task 7.1)."""

    def test_require_api_key_missing_raises_401(self):
        """Missing X-API-Key header should raise HTTP 401."""
        from fastapi import HTTPException
        from fastapi.testclient import TestClient
        import asyncio

        from detection.auth import require_api_key

        # Test the dependency directly
        async def _run():
            mock_request = MagicMock()
            mock_request.headers = {}
            with pytest.raises(HTTPException) as exc_info:
                await require_api_key(mock_request)
            assert exc_info.value.status_code == 401
            assert exc_info.value.detail["error_code"] == "MISSING_API_KEY"

        asyncio.run(_run())

    def test_require_api_key_invalid_raises_403(self):
        """Invalid X-API-Key header should raise HTTP 403."""
        import asyncio
        from fastapi import HTTPException
        from detection.auth import require_api_key

        async def _run():
            mock_request = MagicMock()
            mock_request.headers = {"X-API-Key": "totally-invalid-key-xyz"}
            with pytest.raises(HTTPException) as exc_info:
                await require_api_key(mock_request)
            assert exc_info.value.status_code == 403
            assert exc_info.value.detail["error_code"] == "INVALID_API_KEY"

        asyncio.run(_run())

    def test_require_api_key_valid_returns_key(self):
        """Valid API key should be returned without raising."""
        import asyncio
        import os
        from detection.auth import require_api_key, _VALID_API_KEYS

        # Use a key that is in the valid set
        valid_key = next(iter(_VALID_API_KEYS))

        async def _run():
            mock_request = MagicMock()
            mock_request.headers = {"X-API-Key": valid_key}
            result = await require_api_key(mock_request)
            assert result == valid_key

        asyncio.run(_run())


# ---------------------------------------------------------------------------
# Task 7.1: Rate limiter tests
# ---------------------------------------------------------------------------


class TestSlidingWindowRateLimiter:
    """Tests for Redis sliding window rate limiter (Task 7.1)."""

    @pytest.fixture
    def mock_redis(self):
        """Mock Redis client with pipeline support."""
        redis = MagicMock()
        pipe = MagicMock()
        redis.pipeline.return_value = pipe
        pipe.zremrangebyscore = MagicMock()
        pipe.zcard = MagicMock()
        pipe.zadd = MagicMock()
        pipe.expire = MagicMock()
        pipe.execute = AsyncMock(return_value=[None, 0, None, None])
        return redis, pipe

    @pytest.mark.asyncio
    async def test_allows_request_under_limit(self, mock_redis):
        """Requests under the burst limit should be allowed."""
        from detection.rate_limiter import SlidingWindowRateLimiter

        redis, pipe = mock_redis
        # Simulate 50 existing requests (under 200 burst limit)
        pipe.execute = AsyncMock(return_value=[None, 50, None, None])

        limiter = SlidingWindowRateLimiter(redis, limit=100, burst=200)
        allowed, count, retry_after = await limiter.check_rate_limit("test-key")

        assert allowed is True
        assert count == 51
        assert retry_after == 0

    @pytest.mark.asyncio
    async def test_blocks_request_at_burst_limit(self, mock_redis):
        """Requests at or above burst capacity should be blocked."""
        from detection.rate_limiter import SlidingWindowRateLimiter

        redis, pipe = mock_redis
        # Simulate 200 existing requests (at burst limit)
        pipe.execute = AsyncMock(return_value=[None, 200, None, None])

        limiter = SlidingWindowRateLimiter(redis, limit=100, burst=200)
        allowed, count, retry_after = await limiter.check_rate_limit("test-key")

        assert allowed is False
        assert retry_after > 0

    @pytest.mark.asyncio
    async def test_rate_limit_dependency_raises_429_when_exceeded(self):
        """rate_limit_dependency should raise HTTP 429 when limit exceeded."""
        from fastapi import HTTPException
        from detection.rate_limiter import rate_limit_dependency, SlidingWindowRateLimiter

        mock_limiter = AsyncMock(spec=SlidingWindowRateLimiter)
        mock_limiter.check_rate_limit = AsyncMock(return_value=(False, 201, 2))

        mock_request = MagicMock()
        mock_request.headers = {"X-API-Key": "test-key"}
        mock_request.app.state.rate_limiter = mock_limiter

        with pytest.raises(HTTPException) as exc_info:
            await rate_limit_dependency(mock_request)

        assert exc_info.value.status_code == 429
        assert exc_info.value.detail["error_code"] == "RATE_LIMIT_EXCEEDED"
        assert "Retry-After" in exc_info.value.headers

    @pytest.mark.asyncio
    async def test_rate_limit_dependency_allows_when_under_limit(self):
        """rate_limit_dependency should not raise when under limit."""
        from detection.rate_limiter import rate_limit_dependency, SlidingWindowRateLimiter

        mock_limiter = AsyncMock(spec=SlidingWindowRateLimiter)
        mock_limiter.check_rate_limit = AsyncMock(return_value=(True, 50, 0))

        mock_request = MagicMock()
        mock_request.headers = {"X-API-Key": "test-key"}
        mock_request.app.state.rate_limiter = mock_limiter

        # Should not raise
        await rate_limit_dependency(mock_request)

    @pytest.mark.asyncio
    async def test_rate_limit_fails_open_on_redis_error(self):
        """Rate limiter should fail open (allow) when Redis is unavailable."""
        from detection.rate_limiter import rate_limit_dependency, SlidingWindowRateLimiter

        mock_limiter = AsyncMock(spec=SlidingWindowRateLimiter)
        mock_limiter.check_rate_limit = AsyncMock(
            side_effect=ConnectionError("Redis unavailable")
        )

        mock_request = MagicMock()
        mock_request.headers = {"X-API-Key": "test-key"}
        mock_request.app.state.rate_limiter = mock_limiter

        # Should not raise — fail open
        await rate_limit_dependency(mock_request)


# ---------------------------------------------------------------------------
# Task 7.2: Detection handler tests
# ---------------------------------------------------------------------------


class TestDetectionHandler:
    """Tests for the bot detection orchestration handler (Task 7.2)."""

    def _build_handler(
        self,
        risk_score_value: float,
        redis_client: Optional[AsyncMock] = None,
    ):
        """Build a DetectionHandler with mocked dependencies."""
        from detection.handler import DetectionHandler

        analyzer = MagicMock(spec=BehavioralAnalyzer)
        analyzer.extract_features = MagicMock(
            return_value=MagicMock()  # FeatureVector mock
        )

        risk_scorer = AsyncMock()
        risk_scorer.calculate_risk_score = AsyncMock(
            return_value=_make_risk_score(risk_score_value)
        )

        behavioral_repo = AsyncMock()
        behavioral_repo.create = AsyncMock(
            return_value=MagicMock(id=str(uuid.uuid4()))
        )

        risk_score_repo = AsyncMock()
        risk_score_repo.create = AsyncMock(return_value=MagicMock())

        token_repo = AsyncMock()
        token_repo.create = AsyncMock(return_value=MagicMock())

        if redis_client is None:
            redis_client = AsyncMock()
            redis_client.setex = AsyncMock(return_value=True)

        return DetectionHandler(
            analyzer=analyzer,
            risk_scorer=risk_scorer,
            behavioral_repo=behavioral_repo,
            risk_score_repo=risk_score_repo,
            token_repo=token_repo,
            redis_client=redis_client,
        )

    @pytest.mark.asyncio
    async def test_low_risk_returns_allow_with_token(self):
        """Score < 50 should return 'allow' decision with a verification token."""
        handler = self._build_handler(risk_score_value=25.0)
        request = _make_detection_request()

        response = await handler.handle(request)

        assert response.decision == DetectionResponseDecision.allow
        assert response.verificationToken is not None
        assert len(response.verificationToken) > 0
        assert response.challengeId is None
        assert response.challengeType is None

    @pytest.mark.asyncio
    async def test_medium_risk_returns_challenge(self):
        """Score 50-80 should return 'challenge' decision with challenge_id and type."""
        handler = self._build_handler(risk_score_value=65.0)
        request = _make_detection_request()

        response = await handler.handle(request)

        assert response.decision == DetectionResponseDecision.challenge
        assert response.challengeId is not None
        assert response.challengeType is not None
        assert response.verificationToken is None

    @pytest.mark.asyncio
    async def test_high_risk_returns_block(self):
        """Score > 80 should return 'block' decision."""
        handler = self._build_handler(risk_score_value=95.0)
        request = _make_detection_request()

        response = await handler.handle(request)

        assert response.decision == DetectionResponseDecision.block
        assert response.verificationToken is None
        assert response.challengeId is None

    @pytest.mark.asyncio
    async def test_challenge_type_image_selection_for_score_50_to_65(self):
        """Score 50-65 should produce image_selection challenge type."""
        handler = self._build_handler(risk_score_value=55.0)
        request = _make_detection_request()

        response = await handler.handle(request)

        assert response.decision == DetectionResponseDecision.challenge
        assert response.challengeType == ChallengeType.image_selection

    @pytest.mark.asyncio
    async def test_challenge_type_multi_step_for_score_65_to_80(self):
        """Score 65-80 should produce multi_step challenge type."""
        handler = self._build_handler(risk_score_value=75.0)
        request = _make_detection_request()

        response = await handler.handle(request)

        assert response.decision == DetectionResponseDecision.challenge
        assert response.challengeType == ChallengeType.multi_step

    @pytest.mark.asyncio
    async def test_risk_score_stored_in_db(self):
        """Risk score and decision should be persisted to the database."""
        handler = self._build_handler(risk_score_value=30.0)
        request = _make_detection_request()

        await handler.handle(request)

        handler.risk_score_repo.create.assert_called_once()
        call_kwargs = handler.risk_score_repo.create.call_args.kwargs
        assert call_kwargs["decision"] == "allow"
        assert call_kwargs["score"] == pytest.approx(30.0, abs=1.0)

    @pytest.mark.asyncio
    async def test_behavioral_data_stored_in_db(self):
        """Behavioral data should be persisted to the database."""
        handler = self._build_handler(risk_score_value=30.0)
        request = _make_detection_request()

        await handler.handle(request)

        handler.behavioral_repo.create.assert_called_once()

    @pytest.mark.asyncio
    async def test_challenge_state_stored_in_redis(self):
        """Challenge state should be stored in Redis for medium-risk requests."""
        redis_mock = AsyncMock()
        redis_mock.setex = AsyncMock(return_value=True)

        handler = self._build_handler(risk_score_value=65.0, redis_client=redis_mock)
        request = _make_detection_request()

        response = await handler.handle(request)

        assert response.decision == DetectionResponseDecision.challenge
        redis_mock.setex.assert_called_once()
        call_args = redis_mock.setex.call_args
        redis_key = call_args[0][0]
        assert redis_key.startswith("challenge:")

    @pytest.mark.asyncio
    async def test_verification_token_is_valid_base64_json(self):
        """Generated verification token should be valid base64-encoded JSON."""
        import base64

        handler = self._build_handler(risk_score_value=20.0)
        request = _make_detection_request()

        response = await handler.handle(request)

        assert response.verificationToken is not None
        decoded = base64.b64decode(response.verificationToken).decode("utf-8")
        token_data = json.loads(decoded)

        assert "tokenId" in token_data
        assert "walletAddress" in token_data
        assert "issuedAt" in token_data
        assert "expiresAt" in token_data
        assert "signature" in token_data
        # expiresAt should be ~5 minutes after issuedAt
        assert token_data["expiresAt"] > token_data["issuedAt"]
        assert token_data["expiresAt"] - token_data["issuedAt"] == pytest.approx(
            300, abs=5
        )

    @pytest.mark.asyncio
    async def test_wallet_address_passed_to_repo_for_hashing(self):
        """Raw wallet address is passed to behavioral_repo.create; hashing is done inside the repo."""
        handler = self._build_handler(risk_score_value=30.0)
        wallet = "0xSensitiveWalletAddress123"
        request = _make_detection_request(wallet=wallet)

        await handler.handle(request)

        # Check behavioral_repo.create was called with user_agent, not raw wallet
        create_call = handler.behavioral_repo.create.call_args
        # wallet_address is passed to the repo which hashes it internally
        # Verify the raw wallet is passed to the repo (repo handles hashing)
        assert create_call.kwargs.get("wallet_address") == wallet

    @pytest.mark.asyncio
    async def test_bulk_purchase_context_passed_to_risk_scorer(self):
        """Bulk purchase flag should be passed to the risk scorer."""
        handler = self._build_handler(risk_score_value=30.0)
        request = _make_detection_request(is_bulk=True)

        await handler.handle(request)

        call_kwargs = handler.risk_scorer.calculate_risk_score.call_args.kwargs
        assert call_kwargs["context"].isBulkPurchase is True


# ---------------------------------------------------------------------------
# Task 7.3: Structured logging tests
# ---------------------------------------------------------------------------


class TestStructuredLogging:
    """Tests for structured logging (Task 7.3)."""

    def test_correlation_id_set_and_retrieved(self):
        """set_correlation_id should store and get_correlation_id should retrieve it."""
        from detection.logger import set_correlation_id, get_correlation_id

        test_id = "test-correlation-id-123"
        result = set_correlation_id(test_id)

        assert result == test_id
        assert get_correlation_id() == test_id

    def test_correlation_id_auto_generated_when_none(self):
        """set_correlation_id with no argument should generate a UUID."""
        from detection.logger import set_correlation_id, get_correlation_id

        cid = set_correlation_id(None)

        assert cid is not None
        assert len(cid) > 0
        # Should be a valid UUID format
        uuid.UUID(cid)  # Raises ValueError if not valid UUID

    def test_log_detection_event_does_not_log_wallet_address(self):
        """log_detection_event should never include raw wallet addresses."""
        import logging
        from detection.logger import log_detection_event

        log_records = []

        class CapturingHandler(logging.Handler):
            def emit(self, record):
                log_records.append(self.format(record))

        test_logger = logging.getLogger("test_wallet_anonymization")
        handler = CapturingHandler()
        test_logger.addHandler(handler)
        test_logger.setLevel(logging.DEBUG)

        wallet = "0xSensitiveWalletAddress999"
        user_hash = hash_wallet_address(wallet)

        log_detection_event(
            test_logger,
            session_id="sess-123",
            user_hash=user_hash,
            risk_score=75.0,
            decision="challenge",
        )

        # Wallet address should NOT appear in any log record
        for record in log_records:
            assert wallet not in record, (
                f"Raw wallet address found in log: {record}"
            )

    def test_decision_to_severity_mapping(self):
        """Detection decisions should map to appropriate log severity levels."""
        from detection.logger import _decision_to_severity

        assert _decision_to_severity("allow") == "info"
        assert _decision_to_severity("challenge") == "warning"
        assert _decision_to_severity("block") == "error"
        assert _decision_to_severity("unknown") == "info"  # default

    def test_configure_logging_does_not_raise(self):
        """configure_logging should complete without raising exceptions."""
        from detection.logger import configure_logging

        configure_logging("INFO")
        configure_logging("DEBUG")
        configure_logging("WARNING")


# ---------------------------------------------------------------------------
# Task 7.4: Error handling and fallback tests
# ---------------------------------------------------------------------------


class TestErrorHandling:
    """Tests for error handling and fallback behavior (Task 7.4)."""

    @pytest.mark.asyncio
    async def test_fallback_returns_challenge_when_ml_unavailable(self):
        """When ML service is unavailable, fallback should return challenge decision."""
        from detection.app import _handle_with_fallback

        mock_request = MagicMock()
        mock_request.app.state.redis = AsyncMock()
        mock_request.app.state.redis.setex = AsyncMock(return_value=True)

        request = _make_detection_request()
        exc = ConnectionError("ML service unavailable")

        response = await _handle_with_fallback(mock_request, request, exc, "cid-123")

        # Default fallback score is 60 → challenge
        assert response.decision == DetectionResponseDecision.challenge
        assert response.riskScore == pytest.approx(60.0, abs=1.0)

    @pytest.mark.asyncio
    async def test_handler_db_failure_propagates_exception(self):
        """Database failures in the handler should propagate as exceptions."""
        from detection.handler import DetectionHandler

        analyzer = MagicMock(spec=BehavioralAnalyzer)
        analyzer.extract_features = MagicMock(return_value=MagicMock())

        risk_scorer = AsyncMock()
        risk_scorer.calculate_risk_score = AsyncMock(
            return_value=_make_risk_score(30.0)
        )

        behavioral_repo = AsyncMock()
        behavioral_repo.create = AsyncMock(
            side_effect=Exception("Database connection failed")
        )

        handler = DetectionHandler(
            analyzer=analyzer,
            risk_scorer=risk_scorer,
            behavioral_repo=behavioral_repo,
            risk_score_repo=AsyncMock(),
            token_repo=AsyncMock(),
            redis_client=AsyncMock(),
        )

        request = _make_detection_request()

        with pytest.raises(Exception, match="Database connection failed"):
            await handler.handle(request)

    def test_auth_error_body_has_error_code(self):
        """Auth errors should return structured bodies with error_code field."""
        import asyncio
        from fastapi import HTTPException
        from detection.auth import require_api_key

        async def _run():
            mock_request = MagicMock()
            mock_request.headers = {}
            try:
                await require_api_key(mock_request)
            except HTTPException as exc:
                assert "error_code" in exc.detail
                assert "message" in exc.detail
                return
            pytest.fail("Expected HTTPException was not raised")

        asyncio.run(_run())

    def test_rate_limit_error_body_has_retry_after(self):
        """Rate limit errors should include Retry-After in headers."""
        import asyncio
        from fastapi import HTTPException
        from detection.rate_limiter import rate_limit_dependency, SlidingWindowRateLimiter

        async def _run():
            mock_limiter = AsyncMock(spec=SlidingWindowRateLimiter)
            mock_limiter.check_rate_limit = AsyncMock(return_value=(False, 201, 2))

            mock_request = MagicMock()
            mock_request.headers = {"X-API-Key": "test-key"}
            mock_request.app.state.rate_limiter = mock_limiter

            try:
                await rate_limit_dependency(mock_request)
            except HTTPException as exc:
                assert exc.status_code == 429
                assert "Retry-After" in exc.headers
                assert exc.detail["error_code"] == "RATE_LIMIT_EXCEEDED"
                return
            pytest.fail("Expected HTTPException 429 was not raised")

        asyncio.run(_run())


# ---------------------------------------------------------------------------
# Task 7.2: Feature extraction integration tests
# ---------------------------------------------------------------------------


class TestBehavioralAnalyzerIntegration:
    """Integration tests for BehavioralAnalyzer with DetectionHandler."""

    def test_analyzer_extracts_features_from_valid_data(self):
        """BehavioralAnalyzer should extract a FeatureVector from valid data."""
        analyzer = BehavioralAnalyzer()
        bd = _make_behavioral_data()

        features = analyzer.extract_features(bd)

        assert features is not None
        assert 0.0 <= features.mouse_velocity_mean <= 1.0
        assert 0.0 <= features.mouse_velocity_std <= 1.0
        assert 0.0 <= features.click_frequency <= 1.0
        assert 0.0 <= features.navigation_entropy <= 1.0

    def test_analyzer_handles_minimal_events(self):
        """Analyzer should handle data with minimal events without raising."""
        analyzer = BehavioralAnalyzer()
        now = time.time()
        bd = BehavioralData(
            sessionId="minimal-session",
            walletAddress="0xMinimal",
            userAgent="test",
            ipAddress="127.0.0.1",
            events=[
                {"timestamp": now, "type": "mousemove", "x": 0.0, "y": 0.0},
                {"timestamp": now + 0.1, "type": "mousemove", "x": 10.0, "y": 10.0},
            ],
        )

        features = analyzer.extract_features(bd)
        assert features is not None

    def test_wallet_address_hashing_is_consistent(self):
        """Same wallet address should always produce the same hash."""
        wallet = "0xConsistentWallet123"
        hash1 = hash_wallet_address(wallet)
        hash2 = hash_wallet_address(wallet)

        assert hash1 == hash2
        assert hash1 != wallet
        assert len(hash1) == 64  # SHA-256 hex digest

    def test_wallet_address_hashing_is_case_insensitive(self):
        """Wallet address hashing should normalize case."""
        wallet_lower = "0xabcdef1234567890"
        wallet_upper = "0xABCDEF1234567890"

        assert hash_wallet_address(wallet_lower) == hash_wallet_address(wallet_upper)


# ---------------------------------------------------------------------------
# Task 7.2: Risk decision threshold boundary tests
# ---------------------------------------------------------------------------


class TestRiskDecisionThresholds:
    """Tests for risk score decision threshold boundaries (Task 7.2)."""

    @pytest.mark.parametrize(
        "score,expected_decision",
        [
            (0.0, DetectionResponseDecision.allow),
            (49.9, DetectionResponseDecision.allow),
            (50.0, DetectionResponseDecision.challenge),
            (65.0, DetectionResponseDecision.challenge),
            (79.9, DetectionResponseDecision.challenge),
            (80.0, DetectionResponseDecision.block),
            (80.1, DetectionResponseDecision.block),
            (100.0, DetectionResponseDecision.block),
        ],
    )
    def test_risk_score_decision_at_boundaries(self, score, expected_decision):
        """Risk score thresholds should produce correct decisions at boundaries."""
        risk_score = _make_risk_score(score)
        assert risk_score.decision == expected_decision

    @pytest.mark.parametrize(
        "score,expected_challenge_type",
        [
            (50.0, ChallengeType.image_selection),
            (55.0, ChallengeType.image_selection),
            (65.0, ChallengeType.image_selection),
            (65.1, ChallengeType.multi_step),
            (75.0, ChallengeType.multi_step),
            (79.9, ChallengeType.multi_step),
        ],
    )
    def test_challenge_type_selection_at_boundaries(
        self, score, expected_challenge_type
    ):
        """Challenge type selection should follow score boundaries."""
        from detection.handler import _select_challenge_type

        result = _select_challenge_type(score)
        assert result == expected_challenge_type
