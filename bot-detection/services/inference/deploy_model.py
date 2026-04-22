"""
Model deployment automation (Task 19.2).

Downloads a model artefact version from MinIO, verifies the artefact is
readable, optionally registers the version in MLflow, and writes a
``current_version`` marker file that the inference service picks up on
its next rolling restart.
"""

from __future__ import annotations

import argparse
import json
import logging
import os
import tempfile

logger = logging.getLogger(__name__)


def download_and_validate(version: str, target_dir: str) -> str:
    from minio import Minio  # type: ignore
    import joblib

    endpoint = os.environ["MINIO_ENDPOINT"]
    bucket = os.getenv("MINIO_MODEL_BUCKET", "bot-detection-models")
    client = Minio(
        endpoint,
        access_key=os.getenv("MINIO_ACCESS_KEY", ""),
        secret_key=os.getenv("MINIO_SECRET_KEY", ""),
        secure=os.getenv("MINIO_SECURE", "true").lower() == "true",
    )
    os.makedirs(target_dir, exist_ok=True)
    model_path = os.path.join(target_dir, "model.joblib")
    client.fget_object(bucket, f"{version}/model.joblib", model_path)
    client.fget_object(bucket, f"{version}/metadata.json", os.path.join(target_dir, "metadata.json"))

    model = joblib.load(model_path)
    if not hasattr(model, "predict_proba"):
        raise RuntimeError("Downloaded artefact does not expose predict_proba")
    return model_path


def register_mlflow(version: str, metadata_path: str) -> None:
    try:
        import mlflow  # type: ignore
    except Exception:  # noqa: BLE001
        logger.warning("mlflow not installed; skipping registry update")
        return
    with open(metadata_path) as fh:
        metadata = json.load(fh)
    mlflow.set_tracking_uri(os.getenv("MLFLOW_TRACKING_URI", "http://mlflow:5000"))
    with mlflow.start_run(run_name=version) as run:
        mlflow.log_params(metadata)
        mlflow.log_artifact(metadata_path)
        result = mlflow.register_model(
            f"runs:/{run.info.run_id}", name="rexell-bot-detection"
        )
        logger.info("Registered model %s v%s", result.name, result.version)


def main() -> None:
    logging.basicConfig(level=logging.INFO)
    parser = argparse.ArgumentParser()
    parser.add_argument("--version", required=True)
    parser.add_argument("--target-dir", default=tempfile.mkdtemp(prefix="model-"))
    parser.add_argument("--register-mlflow", action="store_true")
    args = parser.parse_args()

    model_path = download_and_validate(args.version, args.target_dir)
    logger.info("Downloaded model for %s to %s", args.version, model_path)

    marker = os.getenv("CURRENT_VERSION_MARKER", "/etc/bot-detection/current_version")
    try:
        os.makedirs(os.path.dirname(marker), exist_ok=True)
        with open(marker, "w") as fh:
            fh.write(args.version)
    except OSError:
        logger.warning("Unable to write version marker to %s", marker)

    if args.register_mlflow:
        register_mlflow(args.version, os.path.join(args.target_dir, "metadata.json"))


if __name__ == "__main__":
    main()
