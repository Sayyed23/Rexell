"""
Model training script (Task 18.2) with quality-gate enforcement (Task 18.3).

Trains an XGBoost / scikit-learn gradient booster on the prepared Parquet
splits and emits:

- ``model.joblib``  — the fitted estimator
- ``metrics.json``  — accuracy / precision / recall / F1 / false-positive rate
- ``metadata.json`` — semantic version, training window, feature list

Quality gates: deployment requires accuracy >= 0.95 AND FPR < 0.02.
"""

from __future__ import annotations

import argparse
import json
import logging
import os
import tempfile
from dataclasses import asdict, dataclass
from typing import Iterable

logger = logging.getLogger(__name__)

QUALITY_MIN_ACCURACY = 0.95
QUALITY_MAX_FPR = 0.02


@dataclass
class TrainingMetrics:
    accuracy: float
    precision: float
    recall: float
    f1: float
    false_positive_rate: float
    model_version: str
    passed_quality_gate: bool


def _load_splits(train_path: str, val_path: str, test_path: str):
    import pandas as pd

    train = pd.read_parquet(train_path)
    val = pd.read_parquet(val_path)
    test = pd.read_parquet(test_path)
    feature_cols = [c for c in train.columns if c != "label"]
    x_train, y_train = train[feature_cols], train["label"]
    x_val, y_val = val[feature_cols], val["label"]
    x_test, y_test = test[feature_cols], test["label"]
    return feature_cols, x_train, y_train, x_val, y_val, x_test, y_test


def _compute_metrics(y_true, y_pred) -> dict:
    from sklearn.metrics import (
        accuracy_score,
        confusion_matrix,
        f1_score,
        precision_score,
        recall_score,
    )

    accuracy = float(accuracy_score(y_true, y_pred))
    precision = float(precision_score(y_true, y_pred, zero_division=0))
    recall = float(recall_score(y_true, y_pred, zero_division=0))
    f1 = float(f1_score(y_true, y_pred, zero_division=0))
    tn, fp, _fn, _tp = confusion_matrix(y_true, y_pred, labels=[0, 1]).ravel()
    fpr = float(fp) / float(fp + tn) if (fp + tn) else 0.0
    return {
        "accuracy": accuracy,
        "precision": precision,
        "recall": recall,
        "f1": f1,
        "false_positive_rate": fpr,
    }


def train(
    train_path: str,
    val_path: str,
    test_path: str,
    output_dir: str,
    model_version: str = "v1.0.0",
    log_mlflow: bool = False,
) -> TrainingMetrics:
    """Train the XGBoost model and persist artefacts + metrics."""
    import joblib
    from xgboost import XGBClassifier  # lazy import so shim test environments still pass

    (
        feature_cols,
        x_train,
        y_train,
        x_val,
        y_val,
        x_test,
        y_test,
    ) = _load_splits(train_path, val_path, test_path)

    model = XGBClassifier(
        n_estimators=250,
        max_depth=6,
        learning_rate=0.1,
        objective="binary:logistic",
        eval_metric="logloss",
        random_state=42,
        n_jobs=-1,
    )
    model.fit(x_train, y_train, eval_set=[(x_val, y_val)], verbose=False)

    y_pred = model.predict(x_test)
    metrics = _compute_metrics(y_test, y_pred)
    passed = (
        metrics["accuracy"] >= QUALITY_MIN_ACCURACY
        and metrics["false_positive_rate"] < QUALITY_MAX_FPR
    )

    os.makedirs(output_dir, exist_ok=True)
    joblib.dump(model, os.path.join(output_dir, "model.joblib"))
    with open(os.path.join(output_dir, "metrics.json"), "w") as fh:
        json.dump({**metrics, "model_version": model_version}, fh, indent=2)
    with open(os.path.join(output_dir, "metadata.json"), "w") as fh:
        json.dump(
            {
                "model_version": model_version,
                "features": list(feature_cols),
                "passed_quality_gate": passed,
            },
            fh,
            indent=2,
        )

    if log_mlflow:
        try:
            import mlflow

            with mlflow.start_run(run_name=model_version):
                mlflow.log_params(
                    {
                        "n_estimators": 250,
                        "max_depth": 6,
                        "learning_rate": 0.1,
                        "model_version": model_version,
                    }
                )
                mlflow.log_metrics(metrics)
                mlflow.log_artifacts(output_dir)
        except Exception:  # noqa: BLE001
            logger.warning("mlflow logging skipped", exc_info=True)

    result = TrainingMetrics(
        accuracy=metrics["accuracy"],
        precision=metrics["precision"],
        recall=metrics["recall"],
        f1=metrics["f1"],
        false_positive_rate=metrics["false_positive_rate"],
        model_version=model_version,
        passed_quality_gate=passed,
    )
    if not passed:
        logger.error(
            "Model failed quality gate: accuracy=%.3f (<%.3f) or fpr=%.3f (>=%.3f)",
            result.accuracy,
            QUALITY_MIN_ACCURACY,
            result.false_positive_rate,
            QUALITY_MAX_FPR,
        )
    return result


def _publish_failure_alert(metrics: TrainingMetrics, queue_url: str) -> None:
    try:
        import pika  # type: ignore
    except Exception:  # noqa: BLE001
        logger.warning("pika not installed; skipping quality-gate alert publish")
        return
    try:
        params = pika.URLParameters(queue_url)
        connection = pika.BlockingConnection(params)
        channel = connection.channel()
        channel.queue_declare(queue="bot-detection-alerts", durable=True)
        channel.basic_publish(
            exchange="",
            routing_key="bot-detection-alerts",
            body=json.dumps(
                {
                    "type": "model_quality_gate_failed",
                    "metrics": asdict(metrics),
                }
            ).encode("utf-8"),
        )
        connection.close()
    except Exception:  # noqa: BLE001
        logger.exception("Failed to publish alert about quality-gate failure")


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    parser = argparse.ArgumentParser(description="Train bot-detection model")
    parser.add_argument("--train", required=True)
    parser.add_argument("--val", required=True)
    parser.add_argument("--test", required=True)
    parser.add_argument("--output-dir", default=tempfile.mkdtemp(prefix="model-"))
    parser.add_argument("--version", default="v1.0.0")
    parser.add_argument("--mlflow", action="store_true")
    args = parser.parse_args()

    metrics = train(
        train_path=args.train,
        val_path=args.val,
        test_path=args.test,
        output_dir=args.output_dir,
        model_version=args.version,
        log_mlflow=args.mlflow,
    )
    print(json.dumps(asdict(metrics), indent=2))

    if not metrics.passed_quality_gate:
        alert_queue = os.getenv("RABBITMQ_URL")
        if alert_queue:
            _publish_failure_alert(metrics, alert_queue)
        raise SystemExit(1)
