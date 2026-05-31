"""API key authentication for the AI Insights service.

Validates the ``X-API-Key`` header against the configured key set, mirroring
the detection service's auth contract (401 when missing, 403 when invalid).
"""

from typing import Optional

from fastapi import HTTPException, Request, status

from .config import settings
from .logger import get_logger

logger = get_logger(__name__)

API_KEY_HEADER_NAME = "X-API-Key"


async def require_api_key(request: Request) -> str:
    api_key: Optional[str] = request.headers.get(API_KEY_HEADER_NAME)
    valid_keys = settings.valid_api_keys

    if not api_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={
                "error_code": "MISSING_API_KEY",
                "message": "X-API-Key header is required",
            },
        )

    if api_key not in valid_keys:
        logger.warning(
            "Invalid API key attempt",
            evt="auth_failure",
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
