"""30-dimensional feature builder matching `design.md` `FeatureVector`.

The blockchain master CSV is transaction-level. To match the spec's "behavioural
biometrics" feature vector at the *wallet/session* level we aggregate transactions
per wallet and engineer ratio + entropy + temporal features.
"""

from __future__ import annotations

import numpy as np
import pandas as pd
from sklearn.preprocessing import MinMaxScaler

# Excluded columns: identifiers, free-text, derived labels.
LEAKY_OR_ID_COLS = {
    "transaction_hash",
    "wallet_address",
    "event_id",
    "ip_hash",
    "timestamp",
    "scalping_label",
    "fraud_label",
    "risk_score",
}


def _entropy(series: pd.Series) -> float:
    counts = series.value_counts(normalize=True)
    p = counts.values
    p = p[p > 0]
    return float(-(p * np.log2(p)).sum()) if len(p) else 0.0


def build_master_features(df: pd.DataFrame) -> pd.DataFrame:
    """Aggregate per-wallet features from the transaction-level master CSV.

    Output is one row per ``wallet_address`` with ~30 numeric features and
    a binary ``label`` derived as ``scalping_label.max()`` (a wallet is flagged
    if any of its transactions is flagged).
    """
    if "timestamp" not in df:
        raise ValueError("expected `timestamp` column on master CSV")
    df = df.copy()
    df["timestamp"] = pd.to_datetime(df["timestamp"], errors="coerce")
    df["hour"] = df["timestamp"].dt.hour
    df["dow"] = df["timestamp"].dt.dayofweek

    grouped = df.groupby("wallet_address", sort=False)

    feats = pd.DataFrame(
        {
            # tx counts
            "tx_count": grouped.size(),
            "purchase_count": grouped["transaction_type"]
            .apply(lambda s: (s == "PURCHASE").sum()),
            "resale_count": grouped["is_resale"].apply(lambda s: int(s.sum())),
            "failure_count": grouped["status"].apply(lambda s: (s != "SUCCESS").sum()),
            # ticket-volume features
            "ticket_count_sum": grouped["ticket_count"].sum(),
            "ticket_count_mean": grouped["ticket_count"].mean(),
            "ticket_count_max": grouped["ticket_count"].max(),
            "ticket_count_std": grouped["ticket_count"].std().fillna(0.0),
            # price + markup features
            "price_paid_mean": grouped["price_paid"].mean(),
            "price_paid_std": grouped["price_paid"].std().fillna(0.0),
            "price_paid_max": grouped["price_paid"].max(),
            "markup_pct_mean": grouped["markup_pct"].mean(),
            "markup_pct_std": grouped["markup_pct"].std().fillna(0.0),
            "markup_pct_max": grouped["markup_pct"].max(),
            "high_markup_ratio": grouped["markup_pct"].apply(
                lambda s: float((s > 50).mean())
            ),
            # diversity features
            "unique_events": grouped["event_id"].nunique(),
            "unique_ips": grouped["ip_hash"].nunique(),
            "ip_entropy": grouped["ip_hash"].apply(_entropy),
            "event_entropy": grouped["event_id"].apply(_entropy),
            # temporal features
            "active_hours": grouped["hour"].nunique(),
            "active_dows": grouped["dow"].nunique(),
            "hour_entropy": grouped["hour"].apply(_entropy),
            "session_span_hours": grouped["timestamp"].apply(
                lambda s: (s.max() - s.min()).total_seconds() / 3600.0
                if len(s) > 1
                else 0.0
            ),
            "tx_per_hour": grouped.apply(
                lambda g: len(g)
                / max((g["timestamp"].max() - g["timestamp"].min()).total_seconds() / 3600.0, 1.0)
            ),
            "min_inter_tx_seconds": grouped["timestamp"].apply(
                lambda s: float(s.sort_values().diff().dt.total_seconds().min())
                if len(s) > 1
                else 0.0
            ),
            "mean_inter_tx_seconds": grouped["timestamp"].apply(
                lambda s: float(s.sort_values().diff().dt.total_seconds().mean())
                if len(s) > 1
                else 0.0
            ),
            "burstiness": grouped["timestamp"].apply(
                lambda s: float(
                    (s.sort_values().diff().dt.total_seconds() < 60).mean()
                )
                if len(s) > 1
                else 0.0
            ),
            # behavioural-biometrics proxies derived from the tx pattern.
            # In production these come from the BehavioralAnalyzer feature
            # vector; here we approximate from purchase cadence.
            "purchase_resale_ratio": grouped.apply(
                lambda g: (g["transaction_type"] == "PURCHASE").sum()
                / max(int(g["is_resale"].sum()), 1)
            ),
            "max_tickets_per_event": grouped.apply(
                lambda g: int(g.groupby("event_id")["ticket_count"].sum().max())
            ),
            "events_with_resale": grouped.apply(
                lambda g: int(g[g["is_resale"]]["event_id"].nunique())
            ),
        }
    )

    feats["label"] = grouped["scalping_label"].max().astype(int)
    feats = feats.replace([np.inf, -np.inf], 0).fillna(0.0)
    feats = feats.reset_index(drop=False)
    return feats


def build_synthetic_user_features(df: pd.DataFrame) -> pd.DataFrame:
    """Engineered features from the user-level synthetic dataset.

    Output is per-user with one-hot device/location, derived velocity/intensity
    columns, and a ``label`` column from ``scalper``.
    """
    df = df.copy()
    feats = pd.DataFrame(
        {
            "age": df["age"],
            "account_age_days": df["account_age_days"],
            "ticket_price": df["ticket_price"],
            "purchase_time_sec": df["purchase_time_sec"],
            "resale_price": df["resale_price"],
            "resale_flag": df["resale_flag"].astype(int),
            "log_purchase_time": np.log1p(df["purchase_time_sec"]),
            "price_per_age": df["ticket_price"] / df["account_age_days"].clip(lower=1),
            "is_low_account_age": (df["account_age_days"] < 30).astype(int),
            "fast_purchase": (df["purchase_time_sec"] < 5).astype(int),
            "very_fast_purchase": (df["purchase_time_sec"] < 1).astype(int),
            "resale_markup": (df["resale_price"] - df["ticket_price"]).clip(lower=0),
            "resale_markup_pct": (
                (df["resale_price"] - df["ticket_price"]).clip(lower=0)
                / df["ticket_price"].clip(lower=1)
            ),
        }
    )
    feats = pd.concat(
        [
            feats,
            pd.get_dummies(df["device"], prefix="dev").astype(int),
            pd.get_dummies(df["event_demand"], prefix="demand").astype(int),
            pd.get_dummies(df["location"], prefix="loc").astype(int),
        ],
        axis=1,
    )
    feats["label"] = df["scalper"].astype(int)
    return feats


def normalize(X_train: pd.DataFrame, X_val: pd.DataFrame, X_test: pd.DataFrame):
    """Fit ``MinMaxScaler`` on train; apply to all three splits.

    Returns (scaler, X_train_scaled, X_val_scaled, X_test_scaled).
    """
    scaler = MinMaxScaler()
    X_tr = pd.DataFrame(
        scaler.fit_transform(X_train.values),
        columns=X_train.columns,
        index=X_train.index,
    )
    X_va = pd.DataFrame(
        scaler.transform(X_val.values),
        columns=X_val.columns,
        index=X_val.index,
    )
    X_te = pd.DataFrame(
        scaler.transform(X_test.values),
        columns=X_test.columns,
        index=X_test.index,
    )
    return scaler, X_tr, X_va, X_te
