"""
Generate frontend/ml/training_data.json with features matching the actual
FeatureVector used by the BehavioralAnalyzer and ML inference service.

Old features (3 sparse signals): time_since_last_buy, purchase_count_10s,
event_diversity_24h

New features (10 behavioral biometrics matching FeatureVector):
  - mouse_velocity_mean
  - mouse_velocity_std
  - mouse_acceleration
  - mouse_curvature
  - click_frequency
  - flight_time_mean
  - flight_time_std
  - dwell_time_mean
  - navigation_entropy
  - page_dwell_time_dist

Values are normalized to [0, 1] to match the inference service's expectations.
label: 0 = human, 1 = bot
"""

import json
import math
import os
import random

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
OUTPUT_FILE = os.path.abspath(
    os.path.join(SCRIPT_DIR, "..", "..", "frontend", "ml", "training_data.json")
)

random.seed(42)
N_SAMPLES = 5000
BOT_RATE = 0.30  # 30% positive class for balanced training


def clamp01(v):
    return max(0.0, min(1.0, v))


def gen_human():
    """Human: organic mouse movement, natural keystroke rhythm, varied navigation."""
    return {
        "mouse_velocity_mean": clamp01(random.gauss(0.12, 0.06)),
        "mouse_velocity_std": clamp01(random.gauss(0.20, 0.08)),
        "mouse_acceleration": clamp01(random.gauss(0.08, 0.04)),
        "mouse_curvature": clamp01(random.gauss(0.35, 0.12)),
        "click_frequency": clamp01(random.gauss(0.10, 0.04)),
        "flight_time_mean": clamp01(random.gauss(0.12, 0.05)),
        "flight_time_std": clamp01(random.gauss(0.15, 0.06)),
        "dwell_time_mean": clamp01(random.gauss(0.10, 0.04)),
        "navigation_entropy": clamp01(random.gauss(0.55, 0.15)),
        "page_dwell_time_dist": clamp01(random.gauss(0.30, 0.12)),
        "label": 0,
    }


def gen_bot():
    """Bot: high speed, low variance, straight-line paths, robotic keystrokes."""
    return {
        "mouse_velocity_mean": clamp01(random.gauss(0.75, 0.12)),
        "mouse_velocity_std": clamp01(random.gauss(0.04, 0.02)),
        "mouse_acceleration": clamp01(random.gauss(0.60, 0.15)),
        "mouse_curvature": clamp01(random.gauss(0.05, 0.03)),
        "click_frequency": clamp01(random.gauss(0.65, 0.15)),
        "flight_time_mean": clamp01(random.gauss(0.02, 0.01)),
        "flight_time_std": clamp01(random.gauss(0.01, 0.005)),
        "dwell_time_mean": clamp01(random.gauss(0.01, 0.005)),
        "navigation_entropy": clamp01(random.gauss(0.08, 0.04)),
        "page_dwell_time_dist": clamp01(random.gauss(0.02, 0.01)),
        "label": 1,
    }


def main():
    n_bot = int(N_SAMPLES * BOT_RATE)
    n_human = N_SAMPLES - n_bot

    data = []
    for _ in range(n_human):
        data.append(gen_human())
    for _ in range(n_bot):
        data.append(gen_bot())

    random.shuffle(data)

    # Round all floats for cleaner JSON
    for row in data:
        for k, v in row.items():
            if isinstance(v, float):
                row[k] = round(v, 6)

    os.makedirs(os.path.dirname(OUTPUT_FILE), exist_ok=True)
    with open(OUTPUT_FILE, "w") as f:
        json.dump(data, f, indent=2)

    total = len(data)
    bots = sum(1 for d in data if d["label"] == 1)
    print(f"Generated {total} samples -> {OUTPUT_FILE}")
    print(f"  Bots (label=1): {bots} ({bots/total*100:.1f}%)")
    print(f"  Humans (label=0): {total-bots} ({(total-bots)/total*100:.1f}%)")


if __name__ == "__main__":
    main()
