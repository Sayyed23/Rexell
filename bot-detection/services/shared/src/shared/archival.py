"""
MinIO archival for expired behavioral data (Task 23).

Exports a small helper that fetches expired rows from PostgreSQL, serializes
them to a gzip-compressed JSON-lines blob and uploads to MinIO organised by
year/month/day. Parquet is preferred when the optional ``pyarrow``
dependency is installed but is not required so the module stays importable
in slim test environments.

Requirements: 11.3
"""

from __future__ import annotations

import gzip
import io
import json
import logging
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Iterable, Optional, Protocol

from sqlalchemy import delete, select

from .db.models import BehavioralDataModel
from .utils.time_utils import current_timestamp

logger = logging.getLogger(__name__)


class ObjectStore(Protocol):
    def put_object(
        self,
        bucket: str,
        object_name: str,
        data: io.BytesIO,
        length: int,
        content_type: str,
    ) -> None: ...


@dataclass
class ArchivalResult:
    archived: int
    object_name: str


def _to_parquet_bytes(rows: Iterable[dict]) -> Optional[bytes]:
    """Encode rows to Parquet+gzip if pyarrow is available."""
    try:
        import pyarrow as pa  # type: ignore
        import pyarrow.parquet as pq  # type: ignore
    except Exception:  # noqa: BLE001
        return None
    rows = list(rows)
    if not rows:
        return None
    table = pa.Table.from_pylist(rows)
    buf = pa.BufferOutputStream()
    pq.write_table(table, buf, compression="gzip")
    return bytes(buf.getvalue())


def _to_jsonl_gzip_bytes(rows: Iterable[dict]) -> bytes:
    out = io.BytesIO()
    with gzip.GzipFile(fileobj=out, mode="wb") as gz:
        for row in rows:
            gz.write((json.dumps(row, default=str) + "\n").encode("utf-8"))
    return out.getvalue()


async def archive_expired_behavioral_data(
    session,
    object_store: ObjectStore,
    bucket: str = "bot-detection-archive",
    batch_size: int = 1000,
    now_ts: Optional[int] = None,
) -> ArchivalResult:
    """
    Move expired behavioral data from PostgreSQL to the given object store.

    - Expired records are those whose ``expires_at <= now``.
    - Encodes as Parquet (if pyarrow is present) or JSON-lines gzip otherwise.
    - Deletes from PostgreSQL only after a successful upload.
    """
    now_ts = now_ts if now_ts is not None else current_timestamp()

    stmt = (
        select(BehavioralDataModel)
        .where(BehavioralDataModel.expires_at <= now_ts)
        .limit(batch_size)
    )
    result = await session.execute(stmt)
    records = list(result.scalars().all())
    if not records:
        return ArchivalResult(archived=0, object_name="")

    rows = [
        {
            "id": r.id,
            "session_id": r.session_id,
            "user_hash": r.user_hash,
            "user_agent": r.user_agent,
            "ip_address": r.ip_address,
            "events": r.events,
            "created_at": r.created_at,
            "expires_at": r.expires_at,
        }
        for r in records
    ]

    data_bytes = _to_parquet_bytes(rows)
    if data_bytes is not None:
        extension = "parquet"
        content_type = "application/x-parquet"
    else:
        data_bytes = _to_jsonl_gzip_bytes(rows)
        extension = "jsonl.gz"
        content_type = "application/gzip"

    today = datetime.now(timezone.utc)
    object_name = (
        f"{today.year:04d}/{today.month:02d}/{today.day:02d}/"
        f"behavioral-{now_ts}.{extension}"
    )
    payload = io.BytesIO(data_bytes)
    object_store.put_object(
        bucket=bucket,
        object_name=object_name,
        data=payload,
        length=len(data_bytes),
        content_type=content_type,
    )

    await session.execute(
        delete(BehavioralDataModel).where(
            BehavioralDataModel.id.in_([r.id for r in records])
        )
    )
    await session.commit()
    logger.info(
        "Archived %d behavioral records to %s/%s",
        len(records),
        bucket,
        object_name,
    )
    return ArchivalResult(archived=len(records), object_name=object_name)


__all__ = ["archive_expired_behavioral_data", "ArchivalResult", "ObjectStore"]
