"""
Generate synthetic_ticketing_dataset.csv with behavioral biometrics features.

Replaces the old dataset that had irrelevant features (age, location, device,
event_demand) with features that actually matter for bot detection:

Kept (meaningful):
  - account_age_days: account maturity is a real fraud signal
  - ticket_price: now with realistic continuous distribution
  - purchase_time_sec: time to complete the purchase flow

Removed (useless / privacy concern / fake-looking):
  - age: platforms don't know user's real age; privacy issue
  - location: was only 5 cities with uniform distribution
  - device: only 3 values equally distributed; trivially spoofable

Added (aligned with actual FeatureVector / behavioral analysis):
  - mouse_velocity_mean: average mouse movement speed (px/s)
  - mouse_velocity_std: variance in mouse speed (low = bot)
  - click_frequency: clicks per second during purchase
  - keystroke_flight_time_ms: mean time between keystrokes (ms)
  - navigation_entropy: Shannon entropy of page visits
  - session_duration_sec: total time on site before purchase
  - pages_visited: number of pages browsed
  - scroll_depth_pct: how far down pages user scrolled (0-100)

Labels:
  - resale_flag: whether the ticket was resold
  - scalper: multi-signal label (not just resale_flag copy)

Output: bot-detection/dataset/synthetic_ticketing_dataset.csv
"""

import os
import csv
import math
import random
from datetime import datetime, timedelta

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
OUTPUT_FILE = os.path.abspath(
    os.path.join(SCRIPT_DIR, "..", "dataset", "synthetic_ticketing_dataset.csv")
)
MODIFIED_FILE = os.path.abspath(
    os.path.join(SCRIPT_DIR, "..", "dataset", "synthetic_ticketing_dataset_modified.csv")
)

random.seed(42)

N_ROWS = 5000
SCALPER_RATE = 0.06
BOT_SCALPER_RATE = 0.03
RESALE_BASE_RATE = 0.12

# Ticket price tiers drawn from a realistic distribution
PRICE_TIERS = [
    (10, 30, 0.10),
    (30, 75, 0.25),
    (75, 150, 0.30),
    (150, 300, 0.25),
    (300, 500, 0.10),
]


def pick_price():
    r = random.random()
    cumul = 0
    for lo, hi, weight in PRICE_TIERS:
        cumul += weight
        if r <= cumul:
            return round(random.uniform(lo, hi), 2)
    return round(random.uniform(75, 150), 2)


def sigmoid(x):
    return 1 / (1 + math.exp(-x))


def generate_human_row(uid, purchase_date):
    """Generate a normal human user row."""
    account_age = random.randint(30, 1500)
    ticket_price = pick_price()

    # Human behavioral signals: natural variance, slower, organic
    mouse_vel_mean = random.gauss(350, 120)
    mouse_vel_std = random.gauss(150, 50)
    click_freq = random.gauss(0.8, 0.3)
    keystroke_flight = random.gauss(180, 60)
    nav_entropy = random.gauss(2.5, 0.8)
    session_dur = random.gauss(180, 90)
    pages_visited = random.choices(range(3, 15), weights=[5, 10, 15, 20, 18, 12, 8, 5, 3, 2, 1, 1])[0]
    scroll_depth = random.gauss(65, 20)
    purchase_time = random.gauss(45, 20)

    # Resale: small chance a normal user resells
    resale_flag = 1 if random.random() < 0.08 else 0
    resale_price = round(ticket_price * random.uniform(0.7, 1.15), 2) if resale_flag else ticket_price

    return {
        "user_id": uid,
        "account_age_days": max(1, account_age),
        "ticket_price": ticket_price,
        "purchase_time_sec": round(max(3, purchase_time), 2),
        "mouse_velocity_mean": round(max(10, mouse_vel_mean), 2),
        "mouse_velocity_std": round(max(5, mouse_vel_std), 2),
        "click_frequency": round(max(0.05, click_freq), 3),
        "keystroke_flight_time_ms": round(max(30, keystroke_flight), 1),
        "navigation_entropy": round(max(0.1, nav_entropy), 3),
        "session_duration_sec": round(max(10, session_dur), 1),
        "pages_visited": pages_visited,
        "scroll_depth_pct": round(max(0, min(100, scroll_depth)), 1),
        "resale_price": resale_price,
        "resale_flag": resale_flag,
        "scalper": 0,
        "purchase_date": purchase_date.strftime("%Y-%m-%d"),
    }


def generate_scalper_row(uid, purchase_date):
    """Generate a scalper row: rapid, targeted, resells at markup."""
    account_age = random.randint(60, 800)
    ticket_price = pick_price()

    # Scalpers: faster but still somewhat human-like
    mouse_vel_mean = random.gauss(550, 150)
    mouse_vel_std = random.gauss(80, 30)
    click_freq = random.gauss(1.8, 0.5)
    keystroke_flight = random.gauss(100, 35)
    nav_entropy = random.gauss(1.2, 0.4)
    session_dur = random.gauss(60, 25)
    pages_visited = random.choices(range(2, 8), weights=[15, 30, 25, 15, 10, 5])[0]
    scroll_depth = random.gauss(35, 15)
    purchase_time = random.gauss(12, 5)

    # Scalpers almost always resell
    resale_flag = 1 if random.random() < 0.85 else 0
    markup = random.uniform(1.2, 2.5)
    resale_price = round(ticket_price * markup, 2) if resale_flag else ticket_price

    return {
        "user_id": uid,
        "account_age_days": max(1, account_age),
        "ticket_price": ticket_price,
        "purchase_time_sec": round(max(1.5, purchase_time), 2),
        "mouse_velocity_mean": round(max(10, mouse_vel_mean), 2),
        "mouse_velocity_std": round(max(5, mouse_vel_std), 2),
        "click_frequency": round(max(0.05, click_freq), 3),
        "keystroke_flight_time_ms": round(max(20, keystroke_flight), 1),
        "navigation_entropy": round(max(0.1, nav_entropy), 3),
        "session_duration_sec": round(max(5, session_dur), 1),
        "pages_visited": pages_visited,
        "scroll_depth_pct": round(max(0, min(100, scroll_depth)), 1),
        "resale_price": resale_price,
        "resale_flag": resale_flag,
        "scalper": 1,
        "purchase_date": purchase_date.strftime("%Y-%m-%d"),
    }


def generate_bot_scalper_row(uid, purchase_date):
    """Generate an automated bot-scalper: scripted behavior, instant actions."""
    account_age = random.randint(1, 90)
    ticket_price = pick_price()

    # Bots: unnaturally fast, low variance, minimal browsing
    mouse_vel_mean = random.gauss(1800, 500)
    mouse_vel_std = random.gauss(25, 10)
    click_freq = random.gauss(4.5, 1.2)
    keystroke_flight = random.gauss(20, 8)
    nav_entropy = random.gauss(0.3, 0.15)
    session_dur = random.gauss(8, 4)
    pages_visited = random.choices([1, 2, 3], weights=[60, 30, 10])[0]
    scroll_depth = random.gauss(10, 8)
    purchase_time = random.gauss(2.5, 1.2)

    resale_flag = 1 if random.random() < 0.7 else 0
    markup = random.uniform(1.5, 3.0)
    resale_price = round(ticket_price * markup, 2) if resale_flag else ticket_price

    return {
        "user_id": uid,
        "account_age_days": max(1, account_age),
        "ticket_price": ticket_price,
        "purchase_time_sec": round(max(0.5, purchase_time), 2),
        "mouse_velocity_mean": round(max(10, mouse_vel_mean), 2),
        "mouse_velocity_std": round(max(1, mouse_vel_std), 2),
        "click_frequency": round(max(0.05, click_freq), 3),
        "keystroke_flight_time_ms": round(max(5, keystroke_flight), 1),
        "navigation_entropy": round(max(0.01, nav_entropy), 3),
        "session_duration_sec": round(max(1, session_dur), 1),
        "pages_visited": pages_visited,
        "scroll_depth_pct": round(max(0, min(100, scroll_depth)), 1),
        "resale_price": resale_price,
        "resale_flag": resale_flag,
        "scalper": 1,
        "purchase_date": purchase_date.strftime("%Y-%m-%d"),
    }


def main():
    print("Generating synthetic_ticketing_dataset.csv ...")

    rows = []
    start_date = datetime(2025, 1, 1)
    uid_counter = 0

    n_scalper = int(N_ROWS * SCALPER_RATE)
    n_bot = int(N_ROWS * BOT_SCALPER_RATE)
    n_human = N_ROWS - n_scalper - n_bot

    for _ in range(n_human):
        uid_counter += 1
        date = start_date + timedelta(days=random.randint(0, 180))
        rows.append(generate_human_row(f"user_{uid_counter}", date))

    for _ in range(n_scalper):
        uid_counter += 1
        date = start_date + timedelta(days=random.randint(0, 180))
        rows.append(generate_scalper_row(f"user_{uid_counter}", date))

    for _ in range(n_bot):
        uid_counter += 1
        date = start_date + timedelta(days=random.randint(0, 180))
        rows.append(generate_bot_scalper_row(f"user_{uid_counter}", date))

    random.shuffle(rows)

    fieldnames = [
        "user_id",
        "account_age_days",
        "ticket_price",
        "purchase_time_sec",
        "mouse_velocity_mean",
        "mouse_velocity_std",
        "click_frequency",
        "keystroke_flight_time_ms",
        "navigation_entropy",
        "session_duration_sec",
        "pages_visited",
        "scroll_depth_pct",
        "resale_price",
        "resale_flag",
        "scalper",
        "purchase_date",
    ]

    os.makedirs(os.path.dirname(OUTPUT_FILE), exist_ok=True)

    for path in [OUTPUT_FILE, MODIFIED_FILE]:
        with open(path, "w", newline="") as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            writer.writerows(rows)

    total = len(rows)
    scalpers = sum(1 for r in rows if r["scalper"] == 1)
    resales = sum(1 for r in rows if r["resale_flag"] == 1)

    print(f"Generated {total} rows -> {OUTPUT_FILE}")
    print(f"  Scalpers:     {scalpers} ({scalpers/total*100:.1f}%)")
    print(f"  Resale flags: {resales} ({resales/total*100:.1f}%)")
    print(f"  (Also wrote identical copy to {MODIFIED_FILE})")


if __name__ == "__main__":
    main()
