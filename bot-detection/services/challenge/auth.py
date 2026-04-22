"""
API key authentication for the Challenge Service.

Validates the X-API-Key header against configured API keys.
Returns HTTP 401 for missing keys and HTTP 403 for invalid/unauthorized keys.

Requirements: 4.1, 7.1
"""

import logging
import os
from typing import Optional

from fastapi import HTTPException, Request, status
from fastapi.security import APIKeyHeader

logger = logging.getLogger(__name__)

# Header name for API key authentication
API_KEY_HEADER_NAME = "X-API-Key"

_api_key_header_scheme = APIKeyHeader(name=API_KEY_HEADER_NAME, auto_error=False)


def _load_valid_api_keys() -> set:
    """
    Load valid API keys from environment variables.

    Supports a comma-separated list in CHALLENGE_API_KEYS env var,
    or a single key in CHALLENGE_API_KEY.  Falls back to the detection
    service keys so both services can share the same key set.

    Returns:
        Set of valid API key strings.
    """
    keys: set = set()

    for env_var in ("CHALLENGE_API_KEYS", "DETECTION_API_KEYS"):
        raw = os.getenv(env_var, "")
        if raw:
            keys.update(k.strip() for k in raw.split(",") if k.strip())

    for env_var in ("CHALLENGE_API_KEY", "DETECTION_API_KEY"):
        single = os.getenv(env_var, "")
        if single:
            keys.add(single.strip())

    # Development fallback — only active when no keys are configured
    if not keys:
        env = os.getenv("ENVIRONMENT", "development").lower()
        if env not in ("development", "dev", "local", "test"):
            raise RuntimeError(
                "No API keys configured for Challenge Service. "
                "Set CHALLENGE_API_KEYS or CHALLENGE_API_KEY environment variable."
            )
        dev_key = "dev-api-key-insecure"
        logger.warning(
            "No API keys configured for Challenge Service. "
            "Using insecure development key."
        )
        keys.add(dev_key)
    return keys


# Loaded once at module import; reload by restarting the service
_VALID_API_KEYS: set = _load_valid_api_keys()


async def require_api_key(request: Request) -> str:
    """
    FastAPI dependency that enforces API key authentication.

    Reads the X-API-Key header and validates it against the configured key set.

    Args:
        request: The incoming FastAPI request.

    Returns:
        The validated API key string.

    Raises:
        HTTPException 401: If the X-API-Key header is missing.
        HTTPException 403: If the provided key is not in the valid key set.
    """
    api_key: Optional[str] = request.headers.get(API_KEY_HEADER_NAME)

    if not api_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={
                "error_code": "MISSING_API_KEY",
                "message": "X-API-Key header is required",
            },
        )

    if api_key not in _VALID_API_KEYS:
        logger.warning(
            "Invalid API key attempt on Challenge Service (prefix=%s)",
            api_key[:8] if len(api_key) >= 8 else "***",
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "error_code": "INVALID_API_KEY",
                "message": "The provided API key is not authorized",
            },
        )

    return api_key
