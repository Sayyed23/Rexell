"""
Retention policy enforcement (Task 22.4).

Cleans up behavioral data and audit log rows that have outlived their
retention window. Designed to be run as a CronJob or invoked from a
scheduled worker.

Requirements: 9.5, 11.5
"""

from __future__ import annotations

import logging

from sqlalchemy import delete, select, func
from sqlalchemy.ext.asyncio import AsyncSession

from .db.models import AuditLogModel, BehavioralDataModel
from .privacy import (
    AUDIT_LOG_RETENTION_DAYS,
    BEHAVIORAL_DATA_RETENTION_DAYS,
    LOG_RETENTION_DAYS,
)
from .utils.time_utils import current_timestamp

logger = logging.getLogger(__name__)


async def enforce_retention(session: AsyncSession) -> dict[str, int]:
    """
    Delete expired behavioral_data rows and audit_log entries older than the
    configured retention windows. Returns a summary of rows deleted.
    """
    now = current_timestamp()

    expired_behavioral = delete(BehavioralDataModel).where(
        BehavioralDataModel.expires_at <= now
    )
    audit_cutoff = now - AUDIT_LOG_RETENTION_DAYS * 86400
    expired_audit = delete(AuditLogModel).where(
        AuditLogModel.timestamp <= audit_cutoff
    )

    beh_result = await session.execute(expired_behavioral)
    audit_result = await session.execute(expired_audit)
    await session.commit()

    summary = {
        "behavioral_data_deleted": beh_result.rowcount or 0,
        "audit_log_deleted": audit_result.rowcount or 0,
        "behavioral_retention_days": BEHAVIORAL_DATA_RETENTION_DAYS,
        "log_retention_days": LOG_RETENTION_DAYS,
    }
    logger.info("Retention cleanup summary: %s", summary)
    return summary


async def count_expired(session: AsyncSession) -> int:
    now = current_timestamp()
    stmt = select(func.count(BehavioralDataModel.id)).where(
        BehavioralDataModel.expires_at <= now
    )
    result = await session.execute(stmt)
    return int(result.scalar() or 0)


__all__ = ["enforce_retention", "count_expired"]
