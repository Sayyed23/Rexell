"""
Monthly retraining CronJob entrypoint (Task 20.1).

Runs the full data-prep + training + quality-gate pipeline in a single
process. When running inside Kubernetes a CronJob schedules this script
monthly (``0 2 1 * *``).
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
import sys
import tempfile
from dataclasses import asdict

from . import data_prep, train_model

logger = logging.getLogger(__name__)


def _upload_to_minio(output_dir: str, version: str) -> None:
    bucket = os.getenv("MINIO_MODEL_BUCKET", "bot-detection-models")
    endpoint = os.getenv("MINIO_ENDPOINT")
    access_key = os.getenv("MINIO_ACCESS_KEY")
    secret_key = os.getenv("MINIO_SECRET_KEY")
    if not endpoint or not access_key or not secret_key:
        logger.warning("MinIO credentials not set; skipping artefact upload")
        return
    try:
        from minio import Minio
    except Exception:  # noqa: BLE001
        logger.warning("minio client not installed; skipping artefact upload")
        return
    client = Minio(
        endpoint,
        access_key=access_key,
        secret_key=secret_key,
        secure=os.getenv("MINIO_SECURE", "true").lower() == "true",
    )
    if not client.bucket_exists(bucket):
        client.make_bucket(bucket)
    for filename in os.listdir(output_dir):
        path = os.path.join(output_dir, filename)
        client.fput_object(bucket, f"{version}/{filename}", path)
    logger.info("Uploaded model artefacts for %s to %s", version, bucket)


async def main() -> int:
    logging.basicConfig(level=logging.INFO)
    version = os.getenv("MODEL_VERSION", "v1.0.0")
    output_dir = os.getenv("MODEL_OUTPUT_DIR") or tempfile.mkdtemp(prefix="model-")

    logger.info("Retraining CronJob start version=%s", version)
    dataset = await data_prep.prepare_training_data()
    metrics = train_model.train(
        train_path=dataset.train_path,
        val_path=dataset.val_path,
        test_path=dataset.test_path,
        output_dir=output_dir,
        model_version=version,
        log_mlflow=os.getenv("MLFLOW_ENABLED", "false").lower() == "true",
    )

    logger.info("Training metrics: %s", json.dumps(asdict(metrics), indent=2))

    if metrics.passed_quality_gate:
        _upload_to_minio(output_dir, version)
        logger.info("Quality gates passed — artefacts persisted")
        return 0

    alert_queue = os.getenv("RABBITMQ_URL")
    if alert_queue:
        train_model._publish_failure_alert(metrics, alert_queue)
    logger.error("Quality gates FAILED — deployment aborted")
    return 1


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
