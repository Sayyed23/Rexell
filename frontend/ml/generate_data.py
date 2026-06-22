"""
Generate training_data.json with behavioral biometrics features matching the
FeatureVector used by the ML inference service.

Features (all normalized to [0, 1]):
  mouse_velocity_mean, mouse_velocity_std, mouse_acceleration,
  mouse_curvature, click_frequency, flight_time_mean, flight_time_std,
  dwell_time_mean, navigation_entropy, page_dwell_time_dist

label: 0 = human, 1 = bot
"""

import json
import random

NUM_SAMPLES = 5000
BOT_RATE = 0.30

random.seed(42)


def clamp01(v):
    return max(0.0, min(1.0, v))


data = []

for _ in range(NUM_SAMPLES):
    is_bot = random.random() < BOT_RATE

    if is_bot:
        row = {
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
    else:
        row = {
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

    # Round for cleaner output
    for k, v in row.items():
        if isinstance(v, float):
            row[k] = round(v, 6)

    data.append(row)

random.shuffle(data)

with open("ml/training_data.json", "w") as f:
    json.dump(data, f, indent=2)

bots = sum(1 for d in data if d["label"] == 1)
print(f"Generated {NUM_SAMPLES} samples in ml/training_data.json")
print(f"  Bots: {bots} ({bots/NUM_SAMPLES*100:.0f}%)")
print(f"  Humans: {NUM_SAMPLES-bots} ({(NUM_SAMPLES-bots)/NUM_SAMPLES*100:.0f}%)")
