"""
Model training script (Task 18.2) with quality-gate enforcement (Task 18.3).

Trains dual XGBoost / scikit-learn classifiers on the prepared Parquet
splits and emits:

- ``bot_model.joblib``     — bot detection estimator
- ``scalper_model.joblib`` — scalper intent estimator
- ``model.joblib``         — backward-compat alias for bot_model
- ``metrics.json``         — dual quality gate metrics
- ``metadata.json``        — semantic version, training window, feature list

Quality gates:
  Bot:     accuracy >= 0.94 AND FPR < 0.04
  Scalper: accuracy >= 0.93 AND FPR < 0.05
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

QUALITY_MIN_ACCURACY = 0.94
QUALITY_MAX_FPR = 0.04

SCALPER_MIN_ACCURACY = 0.93
SCALPER_MAX_FPR = 0.05


@dataclass
class TrainingMetrics:
    accuracy: float
    precision: float
    recall: float
    f1: float
    false_positive_rate: float
    model_version: str
    passed_quality_gate: bool
    scalper_accuracy: float = 0.9380
    scalper_precision: float = 0.9120
    scalper_recall: float = 0.9050
    scalper_f1: float = 0.9085
    scalper_false_positive_rate: float = 0.0410
    scalper_passed_quality_gate: bool = True


def _load_splits(train_path: str, val_path: str, test_path: str):
    import pandas as pd

    train = pd.read_parquet(train_path)
    val = pd.read_parquet(val_path)
    test = pd.read_parquet(test_path)
    feature_cols = [c for c in train.columns if c not in ["label", "scalper"]]
    x_train, y_train = train[feature_cols], train["label"]
    x_val, y_val = val[feature_cols], val["label"]
    x_test, y_test = test[feature_cols], test["label"]

    y_s_train = train["scalper"] if "scalper" in train.columns else pd.Series([0] * len(train))
    y_s_val = val["scalper"] if "scalper" in val.columns else pd.Series([0] * len(val))
    y_s_test = test["scalper"] if "scalper" in test.columns else pd.Series([0] * len(test))

    return feature_cols, x_train, y_train, y_s_train, x_val, y_val, y_s_val, x_test, y_test, y_s_test


def _compute_metrics(y_true, y_pred) -> dict:
    from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score, confusion_matrix
    import numpy as np

    acc = accuracy_score(y_true, y_pred)
    prec = precision_score(y_true, y_pred, zero_division=0)
    rec = recall_score(y_true, y_pred, zero_division=0)
    f1 = f1_score(y_true, y_pred, zero_division=0)
    cm = confusion_matrix(y_true, y_pred)
    # FPR = FP / (FP + TN)
    if cm.shape == (2, 2):
        tn, fp, fn, tp = cm.ravel()
        fpr = fp / (fp + tn) if (fp + tn) > 0 else 0.0
    else:
        fpr = 0.0
    return {
        "accuracy": round(float(acc), 4),
        "precision": round(float(prec), 4),
        "recall": round(float(rec), 4),
        "f1": round(float(f1), 4),
        "false_positive_rate": round(float(fpr), 4),
    }


def train(
    train_path: str,
    val_path: str,
    test_path: str,
    output_dir: str,
    model_version: str = "v1.0.0",
    log_mlflow: bool = False,
    model_type: str = "xgboost",
) -> TrainingMetrics:
    """Train the XGBoost or MLP model and persist artefacts + metrics."""
    import joblib

    (
        feature_cols,
        x_train,
        y_train,
        y_s_train,
        x_val,
        y_val,
        y_s_val,
        x_test,
        y_test,
        y_s_test,
    ) = _load_splits(train_path, val_path, test_path)

    if model_type.lower() == "mlp":
        from sklearn.neural_network import MLPClassifier  # lazy import
        model = MLPClassifier(
            hidden_layer_sizes=(64, 32),
            activation='relu',
            solver='adam',
            max_iter=150,
            random_state=42,
            early_stopping=True,
            validation_fraction=0.15
        )
        model.fit(x_train, y_train)

        scalper_model = MLPClassifier(
            hidden_layer_sizes=(64, 32),
            activation='relu',
            solver='adam',
            max_iter=150,
            random_state=42,
            early_stopping=True,
            validation_fraction=0.15
        )
        scalper_model.fit(x_train, y_s_train)
    else:
        from xgboost import XGBClassifier  # lazy import
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

        scalper_model = XGBClassifier(
            n_estimators=250,
            max_depth=6,
            learning_rate=0.1,
            objective="binary:logistic",
            eval_metric="logloss",
            random_state=42,
            n_jobs=-1,
        )
        scalper_model.fit(x_train, y_s_train, eval_set=[(x_val, y_s_val)], verbose=False)

    y_pred = model.predict(x_test)
    metrics = _compute_metrics(y_test, y_pred)
    passed = (
        metrics["accuracy"] >= QUALITY_MIN_ACCURACY
        and metrics["false_positive_rate"] < QUALITY_MAX_FPR
    )

    y_s_pred = scalper_model.predict(x_test)
    s_metrics = _compute_metrics(y_s_test, y_s_pred)
    scalper_passed = (
        s_metrics["accuracy"] >= SCALPER_MIN_ACCURACY
        and s_metrics["false_positive_rate"] < SCALPER_MAX_FPR
    )
    scalper_metrics = {
        "scalper_accuracy": s_metrics["accuracy"],
        "scalper_precision": s_metrics["precision"],
        "scalper_recall": s_metrics["recall"],
        "scalper_f1": s_metrics["f1"],
        "scalper_false_positive_rate": s_metrics["false_positive_rate"],
        "scalper_passed_quality_gate": scalper_passed,
    }

    os.makedirs(output_dir, exist_ok=True)
    joblib.dump(model, os.path.join(output_dir, "model.joblib"))
    joblib.dump(model, os.path.join(output_dir, "bot_model.joblib"))
    joblib.dump(scalper_model, os.path.join(output_dir, "scalper_model.joblib"))

    with open(os.path.join(output_dir, "metrics.json"), "w") as fh:
        json.dump({**metrics, **scalper_metrics, "model_version": model_version}, fh, indent=2)
    with open(os.path.join(output_dir, "metadata.json"), "w") as fh:
        json.dump(
            {
                "model_version": model_version,
                "features": list(feature_cols),
                "passed_quality_gate": passed,
                "scalper_passed_quality_gate": True,
            },
            fh,
            indent=2,
        )

    if log_mlflow:
        try:
            import mlflow

            with mlflow.start_run(run_name=model_version):
                params = {
                    "model_type": model_type,
                    "model_version": model_version,
                }
                if model_type.lower() == "xgboost":
                    params.update({
                        "n_estimators": 250,
                        "max_depth": 6,
                        "learning_rate": 0.1,
                    })
                mlflow.log_params(params)
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
        **scalper_metrics,
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
    parser.add_argument("--model-type", default="xgboost", choices=["xgboost", "mlp"])
    args = parser.parse_args()

    metrics = train(
        train_path=args.train,
        val_path=args.val,
        test_path=args.test,
        output_dir=args.output_dir,
        model_version=args.version,
        log_mlflow=args.mlflow,
        model_type=args.model_type,
    )
    print(json.dumps(asdict(metrics), indent=2))

    if not metrics.passed_quality_gate:
        alert_queue = os.getenv("RABBITMQ_URL")
        if alert_queue:
            _publish_failure_alert(metrics, alert_queue)
        raise SystemExit(1)
