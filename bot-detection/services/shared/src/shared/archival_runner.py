"""
Async entrypoint used by the archival CronJob to push expired rows to MinIO.
"""

from __future__ import annotations

import asyncio
import io
import logging
import os

from .archival import archive_expired_behavioral_data
from .config import settings
from .db.session import get_engine, get_session_maker


class _MinioStoreAdapter:
    """Thin wrapper that turns a ``minio.Minio`` client into the ObjectStore protocol."""

    def __init__(self, client) -> None:  # type: ignore[no-untyped-def]
        self._client = client

    def put_object(  # type: ignore[override]
        self,
        bucket: str,
        object_name: str,
        data: io.BytesIO,
        length: int,
        content_type: str,
    ) -> None:
        if not self._client.bucket_exists(bucket):
            self._client.make_bucket(bucket)
        data.seek(0)
        self._client.put_object(
            bucket_name=bucket,
            object_name=object_name,
            data=data,
            length=length,
            content_type=content_type,
        )


async def main() -> None:
    logging.basicConfig(level=os.getenv("LOG_LEVEL", "INFO"))
    engine = get_engine(os.getenv("DATABASE_URL", settings.DATABASE_URL))
    sm = get_session_maker(engine)

    try:
        from minio import Minio  # type: ignore
    except Exception:  # noqa: BLE001
        logging.warning("minio client missing; aborting archival")
        await engine.dispose()
        return

    endpoint = os.getenv("MINIO_ENDPOINT")
    if not endpoint:
        logging.warning("MINIO_ENDPOINT not set; aborting archival")
        await engine.dispose()
        return

    store = _MinioStoreAdapter(
        Minio(
            endpoint,
            access_key=os.getenv("MINIO_ACCESS_KEY", ""),
            secret_key=os.getenv("MINIO_SECRET_KEY", ""),
            secure=os.getenv("MINIO_SECURE", "true").lower() == "true",
        )
    )

    bucket = os.getenv("MINIO_ARCHIVE_BUCKET", "bot-detection-archive")
    try:
        async with sm() as session:
            await archive_expired_behavioral_data(session, store, bucket=bucket)
    finally:
        await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
