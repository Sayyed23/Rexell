"""Shared plotting helpers."""

from __future__ import annotations

import matplotlib.pyplot as plt
import numpy as np
import seaborn as sns
from sklearn.metrics import precision_recall_curve, roc_curve

sns.set_theme(style="whitegrid", context="notebook")


def confusion(
    cm: np.ndarray,
    *,
    title: str = "Confusion matrix",
    ax=None,
):
    if ax is None:
        _, ax = plt.subplots(figsize=(4, 3.5))
    sns.heatmap(
        cm,
        annot=True,
        fmt="d",
        cmap="Blues",
        cbar=False,
        xticklabels=["pred=0", "pred=1"],
        yticklabels=["true=0", "true=1"],
        ax=ax,
    )
    ax.set_title(title)
    return ax


def roc_pr(
    y_true: np.ndarray,
    y_proba: np.ndarray,
    *,
    name: str = "model",
):
    fig, axes = plt.subplots(1, 2, figsize=(9, 3.5))

    fpr, tpr, _ = roc_curve(y_true, y_proba)
    axes[0].plot(fpr, tpr, label=name)
    axes[0].plot([0, 1], [0, 1], linestyle="--", color="gray")
    axes[0].set_xlabel("False positive rate")
    axes[0].set_ylabel("True positive rate")
    axes[0].set_title("ROC")
    axes[0].legend(loc="lower right")

    prec, rec, _ = precision_recall_curve(y_true, y_proba)
    axes[1].plot(rec, prec, label=name)
    axes[1].set_xlabel("Recall")
    axes[1].set_ylabel("Precision")
    axes[1].set_title("Precision-Recall")
    axes[1].legend(loc="lower left")

    fig.tight_layout()
    return fig
