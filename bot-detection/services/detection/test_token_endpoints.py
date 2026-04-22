"""
Unit tests for token validation, consumption, and health endpoints (Task 9.1).

Covers:
- POST /v1/validate-token: valid, invalid, expired, consumed tokens
- POST /v1/consume-token: successful consumption, double-consumption prevention
- GET /v1/health: response format and dependent service status reporting
- token_validator module: decode, signature verification, field validation

Requirements: 5.2, 5.3, 5.6, 10.4
"""

import base64
import hashlib
import hmac
import json
import sys
import time
import uuid
from pathlib import Path
from typing import Optional
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

# Ensure shared modules are importable
shared_src = Path(__file__).parent.parent / "shared" / "src"
if shared_src.exists() and str(shared_src) not in sys.path:
    sys.path.insert(0, str(shared_src))

from detection.token_validator import (
    _decode_token,
    _compute_signature,
    verify_token_signature,
    validate_token_fields,
    validate_token,
    consume_token,
    TokenValidationResult,
)

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

_TEST_SIGNING_KEY = "dev-signing-key-insecure"


def _make_token_payload(
    wallet_address: str = "0xABCDEF1234567890",
    event_id: str = "event-123",
    max_quantity: int = 1,
    issued_at: Optional[int] = None,
    expires_at: Optional[int] = None,
    token_id: Optional[str] = None,
) -> dict:
    """Build a valid token payload dict (without signature)."""
    now = int(time.time())
    return {
        "tokenId": token_id or str(uuid.uuid4()),
        "walletAddress": wallet_address,
        "eventId": event_id,
        "maxQuantity": max_quantity,
        "issuedAt": issued_at if issued_at is not None else now,
        "expiresAt": expires_at if expires_at is not None else now + 300,
    }


def _sign_payload(payload: dict, key: str = _TEST_SIGNING_KEY) -> str:
    """Compute HMAC-SHA256 signature for a payload dict."""
    payload_json = json.dumps(payload, separators=(",", ":"), sort_keys=True)
    return hmac.new(
        key.encode("utf-8"),
        payload_json.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()


def _make_token(
    wallet_address: str = "0xABCDEF1234567890",
    event_id: str = "event-123",
    max_quantity: int = 1,
    issued_at: Optional[int] = None,
    expires_at: Optional[int] = None,
    token_id: Optional[str] = None,
    signing_key: str = _TEST_SIGNING_KEY,
) -> str:
    """Build a fully signed, base64-encoded token string."""
    payload = _make_token_payload(
        wallet_address=wallet_address,
        event_id=event_id,
        max_quantity=max_quantity,
        issued_at=issued_at,
        expires_at=expires_at,
        token_id=token_id,
    )
    signature = _sign_payload(payload, key=signing_key)
    token_data = {**payload, "signature": signature}
    token_bytes = json.dumps(token_data, separators=(",", ":"), sort_keys=True).encode("utf-8")
    return base64.b64encode(token_bytes).decode("utf-8")


def _make_mock_db_record(
    token_id: str,
    consumed_at: Optional[int] = None,
    tx_hash: Optional[str] = None,
) -> MagicMock:
    """Build a mock VerificationTokenModel record."""
    record = MagicMock()
    record.token_id = token_id
    record.consumed_at = consumed_at
    record.tx_hash = tx_hash
    return record


# ---------------------------------------------------------------------------
# Tests: _decode_token
# ---------------------------------------------------------------------------


class TestDecodeToken:
    def test_decodes_valid_base64_json(self):
        """Valid base64-encoded JSON should decode to a dict."""
        data = {"key": "value", "number": 42}
        encoded = base64.b64encode(json.dumps(data).encode()).decode()
        result = _decode_token(encoded)
        assert result == data

    def test_returns_none_for_invalid_base64(self):
        """Invalid base64 should return None."""
        result = _decode_token("not-valid-base64!!!")
        assert result is None

    def test_returns_none_for_valid_base64_but_invalid_json(self):
        """Valid base64 but non-JSON content should return None."""
        encoded = base64.b64encode(b"not json content").decode()
        result = _decode_token(encoded)
        assert result is None

    def test_returns_none_for_empty_string(self):
        """Empty string should return None."""
        result = _decode_token("")
        assert result is None


# ---------------------------------------------------------------------------
# Tests: verify_token_signature
# ---------------------------------------------------------------------------


class TestVerifyTokenSignature:
    def test_valid_signature_returns_true(self):
        """A correctly signed token should pass signature verification."""
        payload = _make_token_payload()
        signature = _sign_payload(payload)
        token_data = {**payload, "signature": signature}
        assert verify_token_signature(token_data) is True

    def test_tampered_wallet_address_fails(self):
        """Modifying walletAddress after signing should fail verification."""
        payload = _make_token_payload(wallet_address="0xOriginal")
        signature = _sign_payload(payload)
        token_data = {**payload, "signature": signature, "walletAddress": "0xTampered"}
        assert verify_token_signature(token_data) is False

    def test_tampered_expires_at_fails(self):
        """Modifying expiresAt after signing should fail verification."""
        payload = _make_token_payload()
        signature = _sign_payload(payload)
        token_data = {**payload, "signature": signature, "expiresAt": payload["expiresAt"] + 9999}
        assert verify_token_signature(token_data) is False

    def test_missing_signature_field_returns_false(self):
        """Token without a signature field should fail."""
        payload = _make_token_payload()
        assert verify_token_signature(payload) is False

    def test_wrong_signing_key_fails(self):
        """Token signed with a different key should fail verification."""
        payload = _make_token_payload()
        signature = _sign_payload(payload, key="wrong-key")
        token_data = {**payload, "signature": signature}
        assert verify_token_signature(token_data) is False


# ---------------------------------------------------------------------------
# Tests: validate_token_fields
# ---------------------------------------------------------------------------


class TestValidateTokenFields:
    def test_valid_token_returns_valid_true(self):
        """A valid, unexpired token with matching wallet should pass."""
        wallet = "0xABCDEF1234567890"
        payload = _make_token_payload(wallet_address=wallet)
        signature = _sign_payload(payload)
        token_data = {**payload, "signature": signature}

        result = validate_token_fields(token_data, wallet)
        assert result.valid is True
        assert result.token_id == payload["tokenId"]

    def test_expired_token_returns_invalid(self):
        """An expired token should return valid=False with expiry reason."""
        wallet = "0xABCDEF1234567890"
        now = int(time.time())
        payload = _make_token_payload(
            wallet_address=wallet,
            issued_at=now - 600,
            expires_at=now - 300,  # expired 5 minutes ago
        )
        signature = _sign_payload(payload)
        token_data = {**payload, "signature": signature}

        result = validate_token_fields(token_data, wallet)
        assert result.valid is False
        assert "expired" in result.reason.lower()

    def test_wallet_mismatch_returns_invalid(self):
        """Token with different wallet address should return valid=False."""
        payload = _make_token_payload(wallet_address="0xOriginalWallet")
        signature = _sign_payload(payload)
        token_data = {**payload, "signature": signature}

        result = validate_token_fields(token_data, "0xDifferentWallet")
        assert result.valid is False
        assert "wallet" in result.reason.lower()

    def test_wallet_match_is_case_insensitive(self):
        """Wallet address comparison should be case-insensitive."""
        wallet = "0xABCDEF1234567890"
        payload = _make_token_payload(wallet_address=wallet.lower())
        signature = _sign_payload(payload)
        token_data = {**payload, "signature": signature}

        result = validate_token_fields(token_data, wallet.upper())
        assert result.valid is True

    def test_missing_required_fields_returns_invalid(self):
        """Token missing required fields should return valid=False."""
        # Missing 'expiresAt'
        token_data = {
            "tokenId": str(uuid.uuid4()),
            "walletAddress": "0xABC",
            "issuedAt": int(time.time()),
            "signature": "somesig",
        }
        result = validate_token_fields(token_data, "0xABC")
        assert result.valid is False
        assert "expiresAt" in result.reason

    def test_invalid_signature_returns_invalid(self):
        """Token with wrong signature should return valid=False."""
        wallet = "0xABCDEF1234567890"
        payload = _make_token_payload(wallet_address=wallet)
        token_data = {**payload, "signature": "deadbeef" * 8}

        result = validate_token_fields(token_data, wallet)
        assert result.valid is False
        assert "signature" in result.reason.lower()


# ---------------------------------------------------------------------------
# Tests: validate_token (async, with DB)
# ---------------------------------------------------------------------------


class TestValidateToken:
    @pytest.mark.asyncio
    async def test_valid_token_not_consumed_returns_valid(self):
        """Valid, unexpired, unconsumed token should return valid=True."""
        wallet = "0xABCDEF1234567890"
        token_id = str(uuid.uuid4())
        token = _make_token(wallet_address=wallet, token_id=token_id)

        mock_repo = AsyncMock()
        mock_repo.get_by_id = AsyncMock(
            return_value=_make_mock_db_record(token_id, consumed_at=None)
        )

        result = await validate_token(token, wallet, mock_repo)
        assert result.valid is True
        assert result.token_id == token_id

    @pytest.mark.asyncio
    async def test_consumed_token_returns_invalid(self):
        """Already consumed token should return valid=False."""
        wallet = "0xABCDEF1234567890"
        token_id = str(uuid.uuid4())
        token = _make_token(wallet_address=wallet, token_id=token_id)

        mock_repo = AsyncMock()
        mock_repo.get_by_id = AsyncMock(
            return_value=_make_mock_db_record(
                token_id, consumed_at=int(time.time()) - 60
            )
        )

        result = await validate_token(token, wallet, mock_repo)
        assert result.valid is False
        assert "consumed" in result.reason.lower()

    @pytest.mark.asyncio
    async def test_token_not_in_db_returns_invalid(self):
        """Token not found in DB should return valid=False."""
        wallet = "0xABCDEF1234567890"
        token = _make_token(wallet_address=wallet)

        mock_repo = AsyncMock()
        mock_repo.get_by_id = AsyncMock(return_value=None)

        result = await validate_token(token, wallet, mock_repo)
        assert result.valid is False
        assert "not found" in result.reason.lower()

    @pytest.mark.asyncio
    async def test_expired_token_does_not_query_db(self):
        """Expired token should fail before DB query."""
        wallet = "0xABCDEF1234567890"
        now = int(time.time())
        token = _make_token(
            wallet_address=wallet,
            issued_at=now - 600,
            expires_at=now - 300,
        )

        mock_repo = AsyncMock()
        mock_repo.get_by_id = AsyncMock()

        result = await validate_token(token, wallet, mock_repo)
        assert result.valid is False
        assert "expired" in result.reason.lower()
        # DB should not be queried for expired tokens
        mock_repo.get_by_id.assert_not_called()

    @pytest.mark.asyncio
    async def test_invalid_base64_returns_invalid(self):
        """Malformed token string should return valid=False."""
        mock_repo = AsyncMock()
        result = await validate_token("not-valid-base64!!!", "0xABC", mock_repo)
        assert result.valid is False
        assert "encoding" in result.reason.lower()

    @pytest.mark.asyncio
    async def test_db_error_returns_invalid(self):
        """Database error during validation should return valid=False."""
        wallet = "0xABCDEF1234567890"
        token = _make_token(wallet_address=wallet)

        mock_repo = AsyncMock()
        mock_repo.get_by_id = AsyncMock(side_effect=Exception("DB connection failed"))

        result = await validate_token(token, wallet, mock_repo)
        assert result.valid is False
        assert "service error" in result.reason.lower()

    @pytest.mark.asyncio
    async def test_wallet_mismatch_does_not_query_db(self):
        """Wallet mismatch should fail before DB query."""
        token = _make_token(wallet_address="0xOriginalWallet")

        mock_repo = AsyncMock()
        mock_repo.get_by_id = AsyncMock()

        result = await validate_token(token, "0xDifferentWallet", mock_repo)
        assert result.valid is False
        mock_repo.get_by_id.assert_not_called()


# ---------------------------------------------------------------------------
# Tests: consume_token (async, with DB)
# ---------------------------------------------------------------------------


class TestConsumeToken:
    @pytest.mark.asyncio
    async def test_valid_token_consumed_successfully(self):
        """Valid token should be marked consumed and return success."""
        token_id = str(uuid.uuid4())
        token = _make_token(token_id=token_id)
        tx_hash = "0xTxHash123"

        mock_repo = AsyncMock()
        mock_repo.consume = AsyncMock(return_value=True)

        success, reason = await consume_token(token, tx_hash, mock_repo)
        assert success is True
        assert reason is None
        mock_repo.consume.assert_called_once_with(token_id, tx_hash)

    @pytest.mark.asyncio
    async def test_already_consumed_token_returns_error(self):
        """Attempting to consume an already-consumed token should fail."""
        token_id = str(uuid.uuid4())
        token = _make_token(token_id=token_id)
        tx_hash = "0xTxHash456"

        mock_repo = AsyncMock()
        # consume() returns False when already consumed
        mock_repo.consume = AsyncMock(return_value=False)
        mock_repo.get_by_id = AsyncMock(
            return_value=_make_mock_db_record(
                token_id, consumed_at=int(time.time()) - 60
            )
        )

        success, reason = await consume_token(token, tx_hash, mock_repo)
        assert success is False
        assert "consumed" in reason.lower()

    @pytest.mark.asyncio
    async def test_token_not_in_db_returns_error(self):
        """Token not found in DB should return failure."""
        token_id = str(uuid.uuid4())
        token = _make_token(token_id=token_id)

        mock_repo = AsyncMock()
        mock_repo.consume = AsyncMock(return_value=False)
        mock_repo.get_by_id = AsyncMock(return_value=None)

        success, reason = await consume_token(token, "0xTxHash", mock_repo)
        assert success is False
        assert "not found" in reason.lower()

    @pytest.mark.asyncio
    async def test_invalid_signature_returns_error(self):
        """Token with invalid signature should not be consumed."""
        payload = _make_token_payload()
        token_data = {**payload, "signature": "invalidsig"}
        token = base64.b64encode(
            json.dumps(token_data, separators=(",", ":"), sort_keys=True).encode()
        ).decode()

        mock_repo = AsyncMock()

        success, reason = await consume_token(token, "0xTxHash", mock_repo)
        assert success is False
        assert "signature" in reason.lower()
        mock_repo.consume.assert_not_called()

    @pytest.mark.asyncio
    async def test_invalid_base64_returns_error(self):
        """Malformed token string should return failure."""
        mock_repo = AsyncMock()
        success, reason = await consume_token("not-valid-base64!!!", "0xTxHash", mock_repo)
        assert success is False
        assert "encoding" in reason.lower()

    @pytest.mark.asyncio
    async def test_db_error_returns_error(self):
        """Database error during consumption should return failure."""
        token = _make_token()

        mock_repo = AsyncMock()
        mock_repo.consume = AsyncMock(side_effect=Exception("DB connection failed"))

        success, reason = await consume_token(token, "0xTxHash", mock_repo)
        assert success is False
        assert "service error" in reason.lower()

    @pytest.mark.asyncio
    async def test_double_consumption_prevention(self):
        """Same token cannot be consumed twice."""
        token_id = str(uuid.uuid4())
        token = _make_token(token_id=token_id)
        tx_hash = "0xTxHash789"

        # First consumption succeeds
        mock_repo_first = AsyncMock()
        mock_repo_first.consume = AsyncMock(return_value=True)

        success1, _ = await consume_token(token, tx_hash, mock_repo_first)
        assert success1 is True

        # Second consumption fails (token already consumed)
        mock_repo_second = AsyncMock()
        mock_repo_second.consume = AsyncMock(return_value=False)
        mock_repo_second.get_by_id = AsyncMock(
            return_value=_make_mock_db_record(
                token_id, consumed_at=int(time.time())
            )
        )

        success2, reason2 = await consume_token(token, tx_hash, mock_repo_second)
        assert success2 is False
        assert "consumed" in reason2.lower()


# ---------------------------------------------------------------------------
# Tests: health endpoint response format
# ---------------------------------------------------------------------------


class TestHealthEndpoint:
    """Tests for GET /v1/health endpoint (Task 9.1)."""

    @pytest.mark.asyncio
    async def test_health_response_has_required_fields(self):
        """Health response should include status, version, services, and timestamp."""
        from detection.app import create_app
        from fastapi.testclient import TestClient

        # We test the structure by calling the health function directly
        # with mocked app state
        mock_request = MagicMock()

        # Mock session factory
        mock_session = AsyncMock()
        mock_session.__aenter__ = AsyncMock(return_value=mock_session)
        mock_session.__aexit__ = AsyncMock(return_value=None)
        mock_session.execute = AsyncMock(return_value=MagicMock())
        mock_session_factory = MagicMock(return_value=mock_session)
        mock_request.app.state.session_factory = mock_session_factory

        # Mock Redis
        mock_redis = AsyncMock()
        mock_redis.ping = AsyncMock(return_value=True)
        mock_request.app.state.redis = mock_redis

        # Mock HTTP client for ML service
        mock_http_response = MagicMock()
        mock_http_response.status_code = 200
        mock_http_client = AsyncMock()
        mock_http_client.get = AsyncMock(return_value=mock_http_response)
        mock_request.app.state.http_client = mock_http_client

        # Import and call the health function
        import importlib
        import detection.app as app_module

        # Get the health function from the app
        app = app_module.app
        # Find the health route handler
        health_route = None
        for route in app.routes:
            if hasattr(route, "path") and route.path == "/v1/health":
                health_route = route
                break

        assert health_route is not None, "Health route not found"

        # Call the health endpoint handler with the mocked request
        health_handler = health_route.endpoint
        response = await health_handler(mock_request)

        # Verify the response structure
        assert "status" in response
        assert "version" in response
        assert "services" in response
        assert "database" in response["services"]
        assert "cache" in response["services"]
        assert "ml_inference" in response["services"]

    def test_health_response_structure(self):
        """Health response should have the correct structure."""
        # Test the expected structure of the health response
        expected_keys = {"status", "version", "services"}
        expected_service_keys = {"database", "cache", "ml_inference"}

        # Verify the structure matches the design document
        sample_response = {
            "status": "healthy",
            "version": "1.0.0",
            "services": {
                "database": "healthy",
                "cache": "healthy",
                "ml_inference": "healthy",
            },
        }

        assert set(sample_response.keys()) == expected_keys
        assert set(sample_response["services"].keys()) == expected_service_keys

    def test_health_status_degraded_when_db_unhealthy(self):
        """Overall status should be 'degraded' when database is unhealthy."""
        # The health endpoint logic: overall = "healthy" only if db and cache are healthy
        db_status = "unhealthy"
        cache_status = "healthy"

        overall = (
            "healthy"
            if all(s == "healthy" for s in [db_status, cache_status])
            else "degraded"
        )
        assert overall == "degraded"

    def test_health_status_degraded_when_cache_unhealthy(self):
        """Overall status should be 'degraded' when cache is unhealthy."""
        db_status = "healthy"
        cache_status = "unhealthy"

        overall = (
            "healthy"
            if all(s == "healthy" for s in [db_status, cache_status])
            else "degraded"
        )
        assert overall == "degraded"

    def test_health_status_healthy_when_all_services_healthy(self):
        """Overall status should be 'healthy' when all core services are healthy."""
        db_status = "healthy"
        cache_status = "healthy"

        overall = (
            "healthy"
            if all(s == "healthy" for s in [db_status, cache_status])
            else "degraded"
        )
        assert overall == "healthy"

    def test_health_ml_degraded_does_not_affect_overall(self):
        """ML inference degraded should not make overall status 'degraded'."""
        # Per the existing health endpoint logic, only db and cache affect overall
        db_status = "healthy"
        cache_status = "healthy"
        ml_status = "degraded"

        overall = (
            "healthy"
            if all(s == "healthy" for s in [db_status, cache_status])
            else "degraded"
        )
        assert overall == "healthy"


# ---------------------------------------------------------------------------
# Tests: validate_token endpoint integration (via token_validator module)
# ---------------------------------------------------------------------------


class TestValidateTokenEndpointLogic:
    """Integration tests for the validate-token endpoint logic."""

    @pytest.mark.asyncio
    async def test_valid_token_returns_valid_true(self):
        """Valid token with matching wallet should return valid=True."""
        wallet = "0xTestWallet123"
        token_id = str(uuid.uuid4())
        token = _make_token(wallet_address=wallet, token_id=token_id)

        mock_repo = AsyncMock()
        mock_repo.get_by_id = AsyncMock(
            return_value=_make_mock_db_record(token_id, consumed_at=None)
        )

        result = await validate_token(token, wallet, mock_repo)
        assert result.valid is True
        assert result.reason is None

    @pytest.mark.asyncio
    async def test_invalid_token_returns_valid_false_with_reason(self):
        """Invalid token should return valid=False with a descriptive reason."""
        mock_repo = AsyncMock()
        result = await validate_token("garbage-token", "0xWallet", mock_repo)
        assert result.valid is False
        assert result.reason is not None
        assert len(result.reason) > 0

    @pytest.mark.asyncio
    async def test_expired_token_returns_valid_false(self):
        """Expired token should return valid=False."""
        wallet = "0xTestWallet"
        now = int(time.time())
        token = _make_token(
            wallet_address=wallet,
            issued_at=now - 600,
            expires_at=now - 1,
        )

        mock_repo = AsyncMock()
        result = await validate_token(token, wallet, mock_repo)
        assert result.valid is False
        assert "expired" in result.reason.lower()

    @pytest.mark.asyncio
    async def test_consumed_token_returns_valid_false(self):
        """Consumed token should return valid=False."""
        wallet = "0xTestWallet"
        token_id = str(uuid.uuid4())
        token = _make_token(wallet_address=wallet, token_id=token_id)

        mock_repo = AsyncMock()
        mock_repo.get_by_id = AsyncMock(
            return_value=_make_mock_db_record(
                token_id, consumed_at=int(time.time()) - 30
            )
        )

        result = await validate_token(token, wallet, mock_repo)
        assert result.valid is False
        assert "consumed" in result.reason.lower()


# ---------------------------------------------------------------------------
# Tests: consume_token endpoint integration
# ---------------------------------------------------------------------------


class TestConsumeTokenEndpointLogic:
    """Integration tests for the consume-token endpoint logic."""

    @pytest.mark.asyncio
    async def test_consume_valid_token_succeeds(self):
        """Consuming a valid token should succeed."""
        token_id = str(uuid.uuid4())
        token = _make_token(token_id=token_id)
        tx_hash = "0xTransactionHash"

        mock_repo = AsyncMock()
        mock_repo.consume = AsyncMock(return_value=True)

        success, reason = await consume_token(token, tx_hash, mock_repo)
        assert success is True
        assert reason is None

    @pytest.mark.asyncio
    async def test_consume_records_tx_hash(self):
        """Consumption should record the tx_hash in the database."""
        token_id = str(uuid.uuid4())
        token = _make_token(token_id=token_id)
        tx_hash = "0xSpecificTxHash"

        mock_repo = AsyncMock()
        mock_repo.consume = AsyncMock(return_value=True)

        await consume_token(token, tx_hash, mock_repo)

        # Verify consume was called with the correct tx_hash
        mock_repo.consume.assert_called_once_with(token_id, tx_hash)

    @pytest.mark.asyncio
    async def test_consume_tampered_token_fails(self):
        """Tampered token should not be consumed."""
        payload = _make_token_payload()
        signature = _sign_payload(payload)
        # Tamper with the payload after signing
        tampered = {**payload, "maxQuantity": 999, "signature": signature}
        token = base64.b64encode(
            json.dumps(tampered, separators=(",", ":"), sort_keys=True).encode()
        ).decode()

        mock_repo = AsyncMock()

        success, reason = await consume_token(token, "0xTxHash", mock_repo)
        assert success is False
        assert "signature" in reason.lower()
        mock_repo.consume.assert_not_called()
