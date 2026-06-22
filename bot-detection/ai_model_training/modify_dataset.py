"""
Post-process synthetic_ticketing_dataset.csv.

Applies noise injection and minor label adjustments to simulate the gap
between a perfect synthetic generator and messy real-world ground truth,
producing synthetic_ticketing_dataset_modified.csv.

Unlike the old version that artificially forced resale_flag == scalper to
a target accuracy, this version introduces realistic noise:
  - Randomly flips a small fraction of scalper labels (simulating labelling
    errors / grey-area users who are hard to classify)
  - Adds minor Gaussian noise to behavioral features
"""

import csv
import os
import random

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
INPUT_FILE = os.path.abspath(
    os.path.join(SCRIPT_DIR, "..", "dataset", "synthetic_ticketing_dataset.csv")
)
OUTPUT_FILE = os.path.abspath(
    os.path.join(SCRIPT_DIR, "..", "dataset", "synthetic_ticketing_dataset_modified.csv")
)

random.seed(42)

LABEL_FLIP_RATE = 0.02  # 2% label noise
FEATURE_NOISE_COLS = [
    "mouse_velocity_mean",
    "mouse_velocity_std",
    "click_frequency",
    "keystroke_flight_time_ms",
    "navigation_entropy",
    "session_duration_sec",
    "scroll_depth_pct",
]
NOISE_SCALE = 0.05  # 5% relative noise


def main():
    with open(INPUT_FILE, "r", newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        fieldnames = reader.fieldnames
        rows = list(reader)

    print(f"Loaded {len(rows)} rows from {INPUT_FILE}")

    flipped = 0
    for row in rows:
        # Label noise
        if random.random() < LABEL_FLIP_RATE:
            row["scalper"] = "0" if row["scalper"] == "1" else "1"
            flipped += 1

        # Feature noise
        for col in FEATURE_NOISE_COLS:
            val = float(row[col])
            if val > 0:
                noise = val * random.gauss(0, NOISE_SCALE)
                row[col] = str(round(max(0, val + noise), 4))

    with open(OUTPUT_FILE, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)

    print(f"Written {len(rows)} rows to {OUTPUT_FILE}")
    print(f"  Label flips: {flipped}")


if __name__ == "__main__":
    main()
