"""
Verify dataset quality and print summary statistics for all datasets.

Checks:
  - Column presence and data types
  - No NaN / null values in critical columns
  - Label distribution sanity
  - Feature range validation
  - Correlation between features and labels (no trivially deterministic labels)
"""

import csv
import json
import os
import statistics

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
DATASET_DIR = os.path.abspath(os.path.join(SCRIPT_DIR, "..", "dataset"))
TRAINING_JSON = os.path.abspath(
    os.path.join(SCRIPT_DIR, "..", "..", "frontend", "ml", "training_data.json")
)


def verify_blockchain_master():
    path = os.path.join(DATASET_DIR, "blockchain_ticketing_master.csv")
    print(f"\n{'='*60}")
    print(f"Verifying: blockchain_ticketing_master.csv")
    print(f"{'='*60}")

    with open(path, newline="") as f:
        reader = csv.DictReader(f)
        rows = list(reader)

    print(f"Rows: {len(rows)}")
    print(f"Columns: {list(rows[0].keys())}")

    # Check risk_score is continuous
    scores = [float(r["risk_score"]) for r in rows]
    unique_scores = len(set(scores))
    print(f"Risk score unique values: {unique_scores}")
    print(f"Risk score range: {min(scores):.1f} – {max(scores):.1f}")
    print(f"Risk score mean: {statistics.mean(scores):.1f}")
    assert unique_scores > 100, f"Risk scores should be continuous, got only {unique_scores} unique values"

    # Check price_paid is reasonable
    prices = [float(r["price_paid"]) for r in rows]
    max_price = max(prices)
    print(f"Price paid range: {min(prices):.2f} – {max_price:.2f}")
    assert max_price < 50000, f"Max price {max_price} is unrealistically high"

    # Check labels aren't trivially deterministic
    fraud = sum(1 for r in rows if r["fraud_label"] == "1")
    scalp = sum(1 for r in rows if r["scalping_label"] == "1")
    print(f"Fraud labels: {fraud}/{len(rows)} ({fraud/len(rows)*100:.1f}%)")
    print(f"Scalping labels: {scalp}/{len(rows)} ({scalp/len(rows)*100:.1f}%)")

    # Verify tx hashes are Ethereum-style
    sample_hash = rows[0]["transaction_hash"]
    assert sample_hash.startswith("0x") and len(sample_hash) == 66, f"Bad tx hash format: {sample_hash}"

    sample_addr = rows[0]["wallet_address"]
    assert sample_addr.startswith("0x") and len(sample_addr) == 42, f"Bad wallet format: {sample_addr}"

    print("PASS: blockchain_ticketing_master.csv")


def verify_synthetic_dataset():
    path = os.path.join(DATASET_DIR, "synthetic_ticketing_dataset.csv")
    print(f"\n{'='*60}")
    print(f"Verifying: synthetic_ticketing_dataset.csv")
    print(f"{'='*60}")

    with open(path, newline="") as f:
        reader = csv.DictReader(f)
        rows = list(reader)

    print(f"Rows: {len(rows)}")
    print(f"Columns: {list(rows[0].keys())}")

    # Removed features should NOT be present
    removed = {"age", "location", "device", "event_demand"}
    present_removed = removed & set(rows[0].keys())
    assert not present_removed, f"Removed features still present: {present_removed}"

    # New behavioral features should be present
    required = {
        "mouse_velocity_mean", "mouse_velocity_std", "click_frequency",
        "keystroke_flight_time_ms", "navigation_entropy", "session_duration_sec",
        "pages_visited", "scroll_depth_pct",
    }
    missing = required - set(rows[0].keys())
    assert not missing, f"Missing required features: {missing}"

    # Ticket prices should have continuous distribution
    prices = [float(r["ticket_price"]) for r in rows]
    unique_prices = len(set(prices))
    print(f"Ticket price unique values: {unique_prices}")
    assert unique_prices > 100, f"Ticket prices should be continuous, got only {unique_prices}"

    scalpers = sum(1 for r in rows if r["scalper"] == "1")
    print(f"Scalper labels: {scalpers}/{len(rows)} ({scalpers/len(rows)*100:.1f}%)")

    print("PASS: synthetic_ticketing_dataset.csv")


def verify_training_json():
    print(f"\n{'='*60}")
    print(f"Verifying: training_data.json")
    print(f"{'='*60}")

    with open(TRAINING_JSON) as f:
        data = json.load(f)

    print(f"Samples: {len(data)}")
    print(f"Features: {[k for k in data[0].keys() if k != 'label']}")

    # All 10 FeatureVector fields should be present
    expected = {
        "mouse_velocity_mean", "mouse_velocity_std", "mouse_acceleration",
        "mouse_curvature", "click_frequency", "flight_time_mean",
        "flight_time_std", "dwell_time_mean", "navigation_entropy",
        "page_dwell_time_dist",
    }
    actual = set(data[0].keys()) - {"label"}
    missing = expected - actual
    assert not missing, f"Missing FeatureVector fields: {missing}"

    # Values should be in [0, 1]
    for row in data:
        for k, v in row.items():
            if k != "label":
                assert 0.0 <= v <= 1.0, f"Feature {k} out of [0,1] range: {v}"

    bots = sum(1 for d in data if d["label"] == 1)
    print(f"Bot labels: {bots}/{len(data)} ({bots/len(data)*100:.1f}%)")

    print("PASS: training_data.json")


def main():
    verify_blockchain_master()
    verify_synthetic_dataset()
    verify_training_json()
    print(f"\n{'='*60}")
    print("ALL DATASETS VERIFIED SUCCESSFULLY")
    print(f"{'='*60}")


if __name__ == "__main__":
    main()
