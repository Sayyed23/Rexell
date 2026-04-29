"""Data loaders + train/val/test splitting for Rexell bot-detection notebooks."""

from __future__ import annotations

import pathlib
from dataclasses import dataclass

import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split

REPO_ROOT = pathlib.Path(__file__).resolve().parents[3]
DATASET_DIR = REPO_ROOT / "dataset"
ML_DATA_DIR = REPO_ROOT / "ml-training" / "data"


@dataclass(frozen=True)
class Split:
    """Train / validation / test partitions of a feature matrix and label vector."""

    X_train: pd.DataFrame
    X_val: pd.DataFrame
    X_test: pd.DataFrame
    y_train: pd.Series
    y_val: pd.Series
    y_test: pd.Series

    def shapes(self) -> dict[str, tuple[int, int]]:
        return {
            "train": self.X_train.shape,
            "val": self.X_val.shape,
            "test": self.X_test.shape,
        }


def load_master() -> pd.DataFrame:
    """Transaction-level blockchain ticketing master CSV (~12k rows, 15 cols)."""
    df = pd.read_csv(
        DATASET_DIR / "blockchain_ticketing_master.csv",
        parse_dates=["timestamp"],
    )
    # `risk_score` and the `fraud_label` are derived from the same labelling
    # function — keep them as targets only, never as features.
    return df


def load_synthetic_user() -> pd.DataFrame:
    """User-level synthetic ticketing dataset (~5k rows)."""
    return pd.read_csv(
        DATASET_DIR / "synthetic_ticketing_dataset.csv",
        parse_dates=["purchase_date"],
    )


def stratified_split(
    X: pd.DataFrame,
    y: pd.Series,
    *,
    test_size: float = 0.15,
    val_size: float = 0.15,
    random_state: int = 42,
) -> Split:
    """70/15/15 stratified split. ``val_size`` is relative to the *full* dataset."""
    if not 0.0 < test_size < 1.0 or not 0.0 < val_size < 1.0:
        raise ValueError("split fractions must be in (0, 1)")
    if test_size + val_size >= 1.0:
        raise ValueError("test_size + val_size must be < 1")

    X_temp, X_test, y_temp, y_test = train_test_split(
        X, y, test_size=test_size, random_state=random_state, stratify=y
    )
    # val_size is given relative to full set; scale it relative to remaining temp
    relative_val = val_size / (1.0 - test_size)
    X_train, X_val, y_train, y_val = train_test_split(
        X_temp,
        y_temp,
        test_size=relative_val,
        random_state=random_state,
        stratify=y_temp,
    )
    return Split(
        X_train=X_train.reset_index(drop=True),
        X_val=X_val.reset_index(drop=True),
        X_test=X_test.reset_index(drop=True),
        y_train=y_train.reset_index(drop=True),
        y_val=y_val.reset_index(drop=True),
        y_test=y_test.reset_index(drop=True),
    )


def save_split(split: Split, name: str = "main") -> pathlib.Path:
    """Persist a split to ml-training/data/<name>.parquet for reuse across notebooks."""
    ML_DATA_DIR.mkdir(parents=True, exist_ok=True)
    out = ML_DATA_DIR / f"{name}.parquet"
    bundle = pd.concat(
        [
            split.X_train.assign(_split="train", _label=split.y_train.values),
            split.X_val.assign(_split="val", _label=split.y_val.values),
            split.X_test.assign(_split="test", _label=split.y_test.values),
        ],
        ignore_index=True,
    )
    bundle.to_parquet(out, index=False)
    return out


def load_split(name: str = "main") -> Split:
    bundle = pd.read_parquet(ML_DATA_DIR / f"{name}.parquet")
    parts = {}
    for s in ("train", "val", "test"):
        sub = (
            bundle[bundle["_split"] == s]
            .drop(columns=["_split"])
            .reset_index(drop=True)
        )
        parts[s] = (sub.drop(columns=["_label"]), sub["_label"].astype(int))
    return Split(
        X_train=parts["train"][0],
        X_val=parts["val"][0],
        X_test=parts["test"][0],
        y_train=parts["train"][1],
        y_val=parts["val"][1],
        y_test=parts["test"][1],
    )


def class_balance(y: pd.Series) -> dict[str, float]:
    counts = y.value_counts(dropna=False).sort_index()
    total = int(counts.sum())
    return {
        "n_total": total,
        "n_pos": int(counts.get(1, 0)),
        "n_neg": int(counts.get(0, 0)),
        "pos_pct": float(counts.get(1, 0)) / total if total else float("nan"),
    }


def set_seed(seed: int = 42) -> None:
    """Seed numpy + (if available) torch + tensorflow for reproducible runs."""
    import random

    random.seed(seed)
    np.random.seed(seed)
    try:
        import torch

        torch.manual_seed(seed)
        if torch.cuda.is_available():
            torch.cuda.manual_seed_all(seed)
    except Exception:
        pass
    try:
        import tensorflow as tf  # type: ignore[import-not-found]

        tf.random.set_seed(seed)
    except Exception:
        pass
