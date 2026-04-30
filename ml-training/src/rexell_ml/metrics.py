"""Evaluation metrics + Property 8 quality gate."""

from __future__ import annotations

from dataclasses import dataclass, asdict

import numpy as np
import pandas as pd
from sklearn.metrics import (
    accuracy_score,
    average_precision_score,
    confusion_matrix,
    f1_score,
    precision_score,
    recall_score,
    roc_auc_score,
)

# Property 8 — design.md / requirements R3.2, R3.3.
ACCURACY_GATE = 0.95
FPR_GATE = 0.02


@dataclass
class ModelMetrics:
    name: str
    threshold: float
    accuracy: float
    precision: float
    recall: float
    f1: float
    fpr: float
    roc_auc: float
    pr_auc: float
    tp: int
    fp: int
    tn: int
    fn: int

    def to_dict(self) -> dict:
        return asdict(self)

    def passes_property_8(self) -> bool:
        return self.accuracy >= ACCURACY_GATE and self.fpr < FPR_GATE


def evaluate(
    y_true: np.ndarray,
    y_proba: np.ndarray,
    *,
    threshold: float = 0.5,
    name: str = "model",
) -> ModelMetrics:
    y_pred = (y_proba >= threshold).astype(int)
    tn, fp, fn, tp = confusion_matrix(y_true, y_pred, labels=[0, 1]).ravel()
    fpr = fp / (fp + tn) if (fp + tn) else 0.0
    return ModelMetrics(
        name=name,
        threshold=float(threshold),
        accuracy=float(accuracy_score(y_true, y_pred)),
        precision=float(precision_score(y_true, y_pred, zero_division=0)),
        recall=float(recall_score(y_true, y_pred, zero_division=0)),
        f1=float(f1_score(y_true, y_pred, zero_division=0)),
        fpr=float(fpr),
        roc_auc=float(roc_auc_score(y_true, y_proba))
        if len(np.unique(y_true)) > 1
        else float("nan"),
        pr_auc=float(average_precision_score(y_true, y_proba))
        if len(np.unique(y_true)) > 1
        else float("nan"),
        tp=int(tp),
        fp=int(fp),
        tn=int(tn),
        fn=int(fn),
    )


def threshold_for_target_fpr(
    y_true: np.ndarray,
    y_proba: np.ndarray,
    *,
    target_fpr: float = FPR_GATE,
) -> float:
    """Smallest threshold whose FPR is strictly below ``target_fpr``.

    Falls back to 0.5 if no threshold satisfies the constraint.
    """
    grid = np.unique(np.concatenate([y_proba, [0.0, 1.0]]))
    grid.sort()
    best = 0.5
    for t in grid:
        y_pred = (y_proba >= t).astype(int)
        tn, fp, _, _ = confusion_matrix(y_true, y_pred, labels=[0, 1]).ravel()
        fpr = fp / (fp + tn) if (fp + tn) else 0.0
        if fpr < target_fpr:
            best = float(t)
            break
    return best


def metrics_table(metrics: list[ModelMetrics]) -> pd.DataFrame:
    df = pd.DataFrame([m.to_dict() for m in metrics])
    cols = [
        "name",
        "threshold",
        "accuracy",
        "precision",
        "recall",
        "f1",
        "fpr",
        "roc_auc",
        "pr_auc",
        "tp",
        "fp",
        "tn",
        "fn",
    ]
    return df[cols].sort_values("f1", ascending=False).reset_index(drop=True)
