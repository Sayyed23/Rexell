"""
Audit logging helpers (Task 22.3).

Writes structured rows to the ``audit_log`` PostgreSQL table. The API-key
identity is stored as a short SHA-256 digest so we never persist the raw
key value.

Requirements: 9.6
"""

from __future__ import annotations

import hashlib
from typing import Any, Dict, Optional

from sqlalchemy.ext.asyncio import AsyncSession

from .db.repositories import AuditLogRepository


def hash_api_key(api_key: Optional[str]) -> str:
    if not api_key:
        return "anonymous"
    digest = hashlib.sha256(api_key.encode("utf-8")).hexdigest()
    return f"apikey:{digest[:16]}"


async def record_access(
    session: AsyncSession,
    accessor: str,
    operation_type: str,
    resource_type: str,
    resource_id: Optional[str] = None,
    details: Optional[Dict[str, Any]] = None,
) -> None:
    """Record a single audit log entry for a data access event."""
    repo = AuditLogRepository(session)
    await repo.create(
        accessor_identity=accessor,
        operation_type=operation_type,
        resource_type=resource_type,
        resource_id=resource_id,
        details=details,
    )


__all__ = ["hash_api_key", "record_access"]
