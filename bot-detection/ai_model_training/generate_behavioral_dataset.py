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
import hashlib
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

# Simulated ticketing drop event days (spikes in transaction volume)
DROP_DAYS = [12, 35, 76, 115, 158]


def pick_price():
    r = random.random()
    cumul = 0
    for lo, hi, weight in PRICE_TIERS:
        cumul += weight
        if r <= cumul:
            return round(random.uniform(lo, hi), 2)
    return round(random.uniform(75, 150), 2)


def pick_date(start_date):
    if random.random() < 0.65:
        # 65% chance of purchase date matching/near a drop day
        drop_day = random.choice(DROP_DAYS)
        # add slight spread (-1 to +2 days) around drop date
        offset = random.randint(-1, 2)
        day = max(0, min(180, drop_day + offset))
    else:
        day = random.randint(0, 180)
    return start_date + timedelta(days=day)


def sigmoid(x):
    return 1 / (1 + math.exp(-x))


def generate_human_row(uid, purchase_date):
    """Generate a normal human user row with natural variance and correlations."""
    # Exponential/Log-normal skew for account maturity
    account_age = int(random.lognormvariate(5.8, 0.7)) + 1
    account_age = max(30, min(1800, account_age))
    
    ticket_price = pick_price()

    # User pace factor (determines their overall activity tempo: speed, clicks, delays)
    t = random.lognormvariate(0.0, 0.25)
    
    # Biometric features modeled via long-tailed log-normal distributions
    mouse_vel_mean = random.lognormvariate(math.log(350) + math.log(t), 0.25)
    # Variance scales proportionally with the mean velocity
    mouse_vel_std = mouse_vel_mean * random.uniform(0.3, 0.6)
    click_freq = random.lognormvariate(math.log(0.8) + math.log(t), 0.25)
    keystroke_flight = random.lognormvariate(math.log(180) - math.log(t), 0.3)
    nav_entropy = min(5.0, max(0.1, random.gauss(2.5, 0.6)))
    session_dur = random.lognormvariate(math.log(180) - 0.5 * math.log(t), 0.4)
    pages_visited = max(2, int(random.lognormvariate(math.log(7) - 0.2 * math.log(t), 0.3)))
    scroll_depth = min(100.0, max(0.0, random.gauss(65, 18)))
    purchase_time = random.lognormvariate(math.log(45) - math.log(t), 0.35)

    # Resale: small chance a normal user resells
    resale_flag = 1 if random.random() < 0.08 else 0
    resale_price = round(ticket_price * random.uniform(0.7, 1.15), 2) if resale_flag else ticket_price

    # Generate MD5-style realistic user ID suffix
    hashed_uid = f"user_{hashlib.md5(uid.encode()).hexdigest()[:12]}"

    return {
        "user_id": hashed_uid,
        "account_age_days": account_age,
        "ticket_price": ticket_price,
        "purchase_time_sec": round(max(3.0, purchase_time), 2),
        "mouse_velocity_mean": round(max(10.0, mouse_vel_mean), 2),
        "mouse_velocity_std": round(max(5.0, mouse_vel_std), 2),
        "click_frequency": round(max(0.05, click_freq), 3),
        "keystroke_flight_time_ms": round(max(30.0, keystroke_flight), 1),
        "navigation_entropy": round(max(0.1, nav_entropy), 3),
        "session_duration_sec": round(max(10.0, session_dur), 1),
        "pages_visited": pages_visited,
        "scroll_depth_pct": round(max(0.0, min(100.0, scroll_depth)), 1),
        "resale_price": resale_price,
        "resale_flag": resale_flag,
        "scalper": 0,
        "purchase_date": purchase_date.strftime("%Y-%m-%d"),
    }


def generate_scalper_row(uid, purchase_date):
    """Generate a scalper row: rapid, targeted, resells at markup."""
    account_age = int(random.lognormvariate(5.2, 0.8)) + 1
    account_age = max(60, min(1200, account_age))
    
    ticket_price = pick_price()

    t = random.lognormvariate(0.0, 0.2)
    
    mouse_vel_mean = random.lognormvariate(math.log(550) + math.log(t), 0.22)
    mouse_vel_std = mouse_vel_mean * random.uniform(0.15, 0.35)
    click_freq = random.lognormvariate(math.log(1.8) + math.log(t), 0.22)
    keystroke_flight = random.lognormvariate(math.log(100) - math.log(t), 0.25)
    nav_entropy = min(5.0, max(0.1, random.gauss(1.2, 0.3)))
    session_dur = random.lognormvariate(math.log(60) - 0.5 * math.log(t), 0.3)
    pages_visited = max(1, int(random.lognormvariate(math.log(4) - 0.2 * math.log(t), 0.25)))
    scroll_depth = min(100.0, max(0.0, random.gauss(35, 12)))
    purchase_time = random.lognormvariate(math.log(12) - math.log(t), 0.25)

    # Scalpers almost always resell
    resale_flag = 1 if random.random() < 0.85 else 0
    markup = random.uniform(1.2, 2.5)
    resale_price = round(ticket_price * markup, 2) if resale_flag else ticket_price

    hashed_uid = f"user_{hashlib.md5(uid.encode()).hexdigest()[:12]}"

    return {
        "user_id": hashed_uid,
        "account_age_days": account_age,
        "ticket_price": ticket_price,
        "purchase_time_sec": round(max(1.5, purchase_time), 2),
        "mouse_velocity_mean": round(max(10.0, mouse_vel_mean), 2),
        "mouse_velocity_std": round(max(5.0, mouse_vel_std), 2),
        "click_frequency": round(max(0.05, click_freq), 3),
        "keystroke_flight_time_ms": round(max(20.0, keystroke_flight), 1),
        "navigation_entropy": round(max(0.1, nav_entropy), 3),
        "session_duration_sec": round(max(5.0, session_dur), 1),
        "pages_visited": pages_visited,
        "scroll_depth_pct": round(max(0.0, min(100.0, scroll_depth)), 1),
        "resale_price": resale_price,
        "resale_flag": resale_flag,
        "scalper": 1,
        "purchase_date": purchase_date.strftime("%Y-%m-%d"),
    }


def generate_bot_scalper_row(uid, purchase_date):
    """Generate an automated bot-scalper: scripted behavior, instant actions."""
    account_age = int(random.lognormvariate(2.5, 1.2)) + 1
    account_age = max(1, min(90, account_age))
    
    ticket_price = pick_price()

    t = random.lognormvariate(0.0, 0.15)
    
    mouse_vel_mean = random.lognormvariate(math.log(1800) + math.log(t), 0.15)
    mouse_vel_std = mouse_vel_mean * random.uniform(0.01, 0.05)  # straight scripted paths -> low variance
    click_freq = random.lognormvariate(math.log(4.5) + math.log(t), 0.15)
    keystroke_flight = random.lognormvariate(math.log(20) - math.log(t), 0.15)
    nav_entropy = min(5.0, max(0.01, random.gauss(0.3, 0.12)))
    session_dur = random.lognormvariate(math.log(8) - 0.5 * math.log(t), 0.2)
    pages_visited = random.choices([1, 2, 3], weights=[70, 20, 10])[0]
    scroll_depth = min(100.0, max(0.0, random.gauss(8, 4)))
    purchase_time = random.lognormvariate(math.log(2.5) - math.log(t), 0.2)

    resale_flag = 1 if random.random() < 0.70 else 0
    markup = random.uniform(1.5, 3.0)
    resale_price = round(ticket_price * markup, 2) if resale_flag else ticket_price

    hashed_uid = f"user_{hashlib.md5(uid.encode()).hexdigest()[:12]}"

    return {
        "user_id": hashed_uid,
        "account_age_days": account_age,
        "ticket_price": ticket_price,
        "purchase_time_sec": round(max(0.3, purchase_time), 2),
        "mouse_velocity_mean": round(max(10.0, mouse_vel_mean), 2),
        "mouse_velocity_std": round(max(1.0, mouse_vel_std), 2),
        "click_frequency": round(max(0.05, click_freq), 3),
        "keystroke_flight_time_ms": round(max(5.0, keystroke_flight), 1),
        "navigation_entropy": round(max(0.01, nav_entropy), 3),
        "session_duration_sec": round(max(1.0, session_dur), 1),
        "pages_visited": pages_visited,
        "scroll_depth_pct": round(max(0.0, min(100.0, scroll_depth)), 1),
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
        date = pick_date(start_date)
        rows.append(generate_human_row(f"user_{uid_counter}", date))

    for _ in range(n_scalper):
        uid_counter += 1
        date = pick_date(start_date)
        rows.append(generate_scalper_row(f"user_{uid_counter}", date))

    for _ in range(n_bot):
        uid_counter += 1
        date = pick_date(start_date)
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
