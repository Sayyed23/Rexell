"""
Token validation and consumption logic for the Detection Service.

Provides functions to:
- Decode and verify HMAC-SHA256 signed verification tokens
- Check token expiration and wallet address match
- Check token not already consumed (via PostgreSQL)
- Mark tokens as consumed with tx_hash

Token structure (base64-encoded JSON):
{
    "tokenId": "uuid",
    "walletAddress": "0x...",
    "eventId": "...",
    "maxQuantity": 1,
    "issuedAt": 1234567890,
    "expiresAt": 1234568190,
    "signature": "hmac-sha256-hex"
}

Requirements: 5.2, 5.3, 5.6
"""

import base64
import hashlib
import hmac
import json
import os
from dataclasses import dataclass
from typing import Optional

from .logger import get_logger

logger = get_logger(__name__)

# Signing key from environment (same key used in handler.py for generation)
_TOKEN_SIGNING_KEY = os.getenv("TOKEN_SIGNING_KEY", "")
if not _TOKEN_SIGNING_KEY:
    if os.getenv("ENVIRONMENT", "development").lower() == "production":
        raise RuntimeError("TOKEN_SIGNING_KEY must be set in production")
    _TOKEN_SIGNING_KEY = "dev-signing-key-insecure"
    logger.warning(
        "insecure_signing_key",
        message="Using insecure default TOKEN_SIGNING_KEY - not suitable for production",
    )

@dataclass
class TokenValidationResult:
    """Result of a token validation attempt."""

    valid: bool
    reason: Optional[str] = None
    token_id: Optional[str] = None
    wallet_address: Optional[str] = None


def _decode_token(token: str) -> Optional[dict]:
    """
    Decode a base64-encoded token string into a dict.

    Returns None if decoding or JSON parsing fails.
    """
    try:
        decoded_bytes = base64.b64decode(token)
        return json.loads(decoded_bytes.decode("utf-8"))
    except Exception:
        return None


def _compute_signature(payload: dict) -> str:
    """
    Compute the HMAC-SHA256 signature for a token payload.

    The payload dict must NOT include the 'signature' key.
    Uses the same serialization as handler.py: separators=(",", ":"), sort_keys=True.
    """
    payload_json = json.dumps(payload, separators=(",", ":"), sort_keys=True)
    return hmac.new(
        _TOKEN_SIGNING_KEY.encode("utf-8"),
        payload_json.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()


def verify_token_signature(token_data: dict) -> bool:
    """
    Verify the HMAC-SHA256 signature of a decoded token.

    Extracts the signature from the token, recomputes it over the remaining
    payload fields, and compares using a constant-time comparison.

    Args:
        token_data: Decoded token dict including 'signature' key.

    Returns:
        True if signature is valid, False otherwise.
    """
    provided_signature = token_data.get("signature")
    if not provided_signature:
        return False

    # Reconstruct payload without the signature field
    payload = {k: v for k, v in token_data.items() if k != "signature"}
    expected_signature = _compute_signature(payload)

    return hmac.compare_digest(provided_signature, expected_signature)


def validate_token_fields(
    token_data: dict,
    wallet_address: str,
) -> TokenValidationResult:
    """
    Validate token fields: required keys, expiration, and wallet address match.

    Does NOT check database state (consumed status). That requires an async DB call.

    Args:
        token_data: Decoded token dict.
        wallet_address: The wallet address from the request to match against.

    Returns:
        TokenValidationResult with valid=True or valid=False and a reason.
    """
    import time

    required_fields = {"tokenId", "walletAddress", "issuedAt", "expiresAt", "signature"}
    missing = required_fields - set(token_data.keys())
    if missing:
        return TokenValidationResult(
            valid=False,
            reason=f"Token missing required fields: {', '.join(sorted(missing))}",
        )

    # Verify signature
    if not verify_token_signature(token_data):
        return TokenValidationResult(valid=False, reason="Invalid token signature")

    # Check expiration
    expires_at = token_data.get("expiresAt", 0)
    now = int(time.time())
    if now > expires_at:
        return TokenValidationResult(valid=False, reason="Token has expired")

    # Verify wallet address match (case-insensitive)
    token_wallet = token_data.get("walletAddress", "")
    if token_wallet.lower() != wallet_address.lower():
        return TokenValidationResult(
            valid=False,
            reason="Token wallet address does not match request",
        )

    return TokenValidationResult(
        valid=True,
        token_id=token_data.get("tokenId"),
        wallet_address=token_wallet,
    )


async def validate_token(
    token: str,
    wallet_address: str,
    token_repo,
) -> TokenValidationResult:
    """
    Full token validation: decode, verify signature, check expiry, wallet match,
    and check not already consumed in PostgreSQL.

    Args:
        token: Base64-encoded token string.
        wallet_address: Wallet address from the request.
        token_repo: VerificationTokenRepository instance.

    Returns:
        TokenValidationResult with valid=True or valid=False and a reason.
    """
    # Step 1: Decode
    token_data = _decode_token(token)
    if token_data is None:
        return TokenValidationResult(valid=False, reason="Invalid token encoding")

    # Step 2: Validate fields, signature, expiry, wallet match
    result = validate_token_fields(token_data, wallet_address)
    if not result.valid:
        return result

    token_id = token_data["tokenId"]

    # Step 3: Check not already consumed in PostgreSQL
    try:
        db_record = await token_repo.get_by_id(token_id)
        if db_record is None:
            return TokenValidationResult(
                valid=False,
                reason="Token not found",
                token_id=token_id,
            )
        if db_record.consumed_at is not None:
            return TokenValidationResult(
                valid=False,
                reason="Token has already been consumed",
                token_id=token_id,
            )
    except Exception as exc:
        logger.error(
            "token_validation_db_error",
            message="Database error during token validation",
            token_id=token_id,
            error=str(exc),
        )
        return TokenValidationResult(
            valid=False,
            reason="Token validation service error",
            token_id=token_id,
        )

    return TokenValidationResult(
        valid=True,
        token_id=token_id,
        wallet_address=token_wallet,
    )


async def consume_token(
    token: str,
    tx_hash: str,
    token_repo,
) -> tuple[bool, Optional[str]]:
    """
    Decode, validate, and mark a token as consumed in PostgreSQL.

    Args:
        token: Base64-encoded token string.
        tx_hash: Transaction hash to record with the consumed token.
        token_repo: VerificationTokenRepository instance.

    Returns:
        Tuple of (success: bool, error_reason: Optional[str]).
        success=True means the token was successfully marked consumed.
    """
    # Step 1: Decode
    token_data = _decode_token(token)
    if token_data is None:
        return False, "Invalid token encoding"

    # Step 2: Verify signature (no wallet check needed for consumption)
    if not verify_token_signature(token_data):
        return False, "Invalid token signature"

    # Step 3: Check expiration before consuming
    import time as _time
    expires_at = token_data.get("expiresAt", 0)
    if int(_time.time()) > expires_at:
        return False, "Token expired"

    token_id = token_data.get("tokenId")
    if not token_id:
        return False, "Token missing tokenId"

    # Step 3: Mark consumed in PostgreSQL
    try:
        consumed = await token_repo.consume(token_id, tx_hash)
        if not consumed:
            # consume() returns False if token not found or already consumed
            db_record = await token_repo.get_by_id(token_id)
            if db_record is None:
                return False, "Token not found"
            if db_record.consumed_at is not None:
                return False, "Token has already been consumed"
            return False, "Token consumption failed"
    except Exception as exc:
        logger.error(
            "token_consumption_db_error",
            message="Database error during token consumption",
            token_id=token_id,
            error=str(exc),
        )
        return False, "Token consumption service error"

    logger.info(
        "token_consumed",
        message="Token consumed successfully",
        token_id=token_id,
        tx_hash=tx_hash,
    )
    return True, None
