"""Feature engineering for resale-price / demand forecasting.

Reads Rexell's transaction history (``blockchain_ticketing_master.csv``) and
turns it into:

- per-event ordered sequences of the *markup ratio* (``price_paid /
  original_event_price``) used to train and run the LSTM, and
- per-event summary statistics (median markup, average daily demand, last
  observed window) used both for demand estimates and as the deterministic
  fallback when the LSTM is unavailable.

Only the Python standard library is required here so it can run inside the
inference service without pandas.
"""

import csv
from collections import defaultdict
from datetime import datetime
from typing import Dict, List, Optional

WINDOW = 8  # number of recent transactions fed to the LSTM
_FALLBACK_RATIO = 1.0


def _parse_ts(value: str) -> Optional[datetime]:
    value = (value or "").strip()
    for fmt in ("%Y-%m-%d %H:%M:%S.%f", "%Y-%m-%d %H:%M:%S", "%Y-%m-%d"):
        try:
            return datetime.strptime(value, fmt)
        except ValueError:
            continue
    return None


def _to_float(value: str, default: float = 0.0) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def load_rows(csv_path: str) -> List[dict]:
    """Load and normalise transaction rows, sorted by timestamp."""
    rows: List[dict] = []
    with open(csv_path, newline="") as fh:
        reader = csv.DictReader(fh)
        for r in reader:
            ts = _parse_ts(r.get("timestamp", ""))
            price = _to_float(r.get("price_paid"))
            original = _to_float(r.get("original_event_price"))
            if original <= 0:
                continue
            rows.append(
                {
                    "event_id": (r.get("event_id") or "").strip(),
                    "timestamp": ts,
                    "price_paid": price,
                    "original_event_price": original,
                    "ticket_count": _to_float(r.get("ticket_count"), 1.0),
                    "markup_ratio": price / original if original else _FALLBACK_RATIO,
                    "is_resale": (r.get("is_resale") or "").strip().lower() == "true",
                }
            )
    rows.sort(key=lambda x: (x["timestamp"] or datetime.min))
    return rows


def build_sequences(rows: List[dict], window: int = WINDOW):
    """Build (X, y) sliding windows of markup ratios across the global timeline.

    Returns two lists: ``X`` (list of ``window``-length ratio lists) and ``y``
    (the next ratio). Resale transactions are emphasised by including the whole
    ordered stream, which captures how prices drift around face value.
    """
    ratios = [r["markup_ratio"] for r in rows if r["markup_ratio"] > 0]
    X: List[List[float]] = []
    y: List[float] = []
    for i in range(len(ratios) - window):
        X.append(ratios[i : i + window])
        y.append(ratios[i + window])
    return X, y


def build_event_stats(rows: List[dict], window: int = WINDOW) -> Dict[str, dict]:
    """Per-event statistics for demand estimates and the heuristic fallback."""
    by_event: Dict[str, List[dict]] = defaultdict(list)
    for r in rows:
        if r["event_id"]:
            by_event[r["event_id"]].append(r)

    stats: Dict[str, dict] = {}
    for event_id, evrows in by_event.items():
        ratios = sorted(r["markup_ratio"] for r in evrows if r["markup_ratio"] > 0)
        resale_ratios = sorted(
            r["markup_ratio"] for r in evrows if r["is_resale"] and r["markup_ratio"] > 0
        )
        days = {r["timestamp"].date() for r in evrows if r["timestamp"]}
        n_days = max(len(days), 1)
        total_tickets = sum(r["ticket_count"] for r in evrows)
        last_window = [r["markup_ratio"] for r in evrows[-window:] if r["markup_ratio"] > 0]
        stats[event_id] = {
            "count": len(evrows),
            "median_markup": _median(ratios),
            "median_resale_markup": _median(resale_ratios) if resale_ratios else _median(ratios),
            "avg_daily_demand": round(total_tickets / n_days, 3),
            "last_window": last_window,
        }
    return stats


def global_fallback(rows: List[dict]) -> dict:
    ratios = sorted(r["markup_ratio"] for r in rows if r["markup_ratio"] > 0)
    resale = sorted(r["markup_ratio"] for r in rows if r["is_resale"] and r["markup_ratio"] > 0)
    total_tickets = sum(r["ticket_count"] for r in rows)
    days = {r["timestamp"].date() for r in rows if r["timestamp"]}
    return {
        "median_markup": _median(ratios) if ratios else _FALLBACK_RATIO,
        "median_resale_markup": _median(resale) if resale else (_median(ratios) if ratios else _FALLBACK_RATIO),
        "avg_daily_demand": round(total_tickets / max(len(days), 1), 3),
    }


def _median(values: List[float]) -> float:
    if not values:
        return _FALLBACK_RATIO
    values = sorted(values)
    n = len(values)
    mid = n // 2
    if n % 2:
        return values[mid]
    return (values[mid - 1] + values[mid]) / 2.0
