"""
API key authentication middleware for the Detection Service.

Validates the X-API-Key header against configured API keys.
Returns HTTP 401 for missing keys and HTTP 403 for invalid/unauthorized keys.

Requirements: 7.1
"""

import os
from typing import Optional

from fastapi import Request, HTTPException, status
from fastapi.security import APIKeyHeader

from .logger import get_logger

logger = get_logger(__name__)

# Header name for API key authentication
API_KEY_HEADER_NAME = "X-API-Key"

_api_key_header_scheme = APIKeyHeader(name=API_KEY_HEADER_NAME, auto_error=False)


def _load_valid_api_keys() -> set:
    """
    Load valid API keys from environment variables.

    Supports a comma-separated list in DETECTION_API_KEYS env var,
    or a single key in DETECTION_API_KEY.

    Returns:
        Set of valid API key strings.
    """
    keys_env = os.getenv("DETECTION_API_KEYS", "")
    single_key = os.getenv("DETECTION_API_KEY", "")

    keys: set = set()
    if keys_env:
        keys.update(k.strip() for k in keys_env.split(",") if k.strip())
    if single_key:
        keys.add(single_key.strip())

    # Development fallback — only active when no keys are configured
    if not keys:
        if os.getenv("DETECTION_DEV_MODE", "").lower() == "true":
            dev_key = "dev-api-key-insecure"
            logger.warning(
                "No API keys configured. Using insecure development key.",
                event="auth_config_warning",
            )
            keys.add(dev_key)
        else:
            raise RuntimeError(
                "No API keys configured. Set DETECTION_API_KEYS or DETECTION_API_KEY, "
                "or set DETECTION_DEV_MODE=true for development."
            )
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
            "Invalid API key attempt",
            event="auth_failure",
            key_prefix=api_key[:8] if len(api_key) >= 8 else "***",
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "error_code": "INVALID_API_KEY",
                "message": "The provided API key is not authorized",
            },
        )

    return api_key
