"""
Assemble the blockchain_ticketing_master.csv dataset for Rexell.

Generates realistic on-chain ticketing transactions with:
- Proper Ethereum-style addresses and hashes
- Realistic price distributions (Celo cUSD, typically $5–$500)
- Organic temporal patterns (event lifecycle, burst buying near events)
- Nuanced bot/scalper labels derived from multi-signal behavioral patterns
  rather than trivial single-threshold rules
- Continuous risk scores with natural variance

Output: bot-detection/dataset/blockchain_ticketing_master.csv
"""

import os
import random
import hashlib
import math
from datetime import datetime, timedelta

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
OUTPUT_FILE = os.path.abspath(
    os.path.join(SCRIPT_DIR, "..", "dataset", "blockchain_ticketing_master.csv")
)

random.seed(42)

# --- Config ---
N_ROWS = 12_000
N_EVENTS = 50
BOT_WALLET_COUNT = 25
SCALPER_WALLET_COUNT = 60
NORMAL_WALLET_COUNT = 4_000

# --- Helpers ---


def eth_hash(seed: str) -> str:
    """Generate a deterministic Ethereum-style 0x-prefixed 64-char hex hash."""
    return "0x" + hashlib.sha256(seed.encode()).hexdigest()


def eth_address(seed: str) -> str:
    """Generate a deterministic Ethereum-style 0x-prefixed 40-char hex address."""
    return "0x" + hashlib.sha256(seed.encode()).hexdigest()[:40]


def ip_hash(seed: str) -> str:
    """Generate a deterministic hashed IP."""
    return hashlib.sha256(seed.encode()).hexdigest()[:32]


def clamp(value: float, lo: float = 0.0, hi: float = 100.0) -> float:
    return max(lo, min(hi, value))


# --- Event catalogue ---

EVENT_CATEGORIES = [
    ("concert", 15, 50, 300),
    ("sports", 10, 30, 250),
    ("theater", 8, 40, 200),
    ("festival", 7, 80, 500),
    ("conference", 5, 20, 150),
    ("comedy", 5, 15, 80),
]


def build_events():
    events = []
    idx = 0
    for category, count, price_lo, price_hi in EVENT_CATEGORIES:
        for j in range(count):
            base_price = round(random.uniform(price_lo, price_hi), 2)
            capacity = random.choice([200, 500, 1000, 2000, 5000, 10000])
            event_date = datetime(2025, 6, 1) + timedelta(days=random.randint(0, 90))
            sale_opens = event_date - timedelta(days=random.randint(14, 60))
            events.append(
                {
                    "event_id": f"EVT_{idx:03d}",
                    "category": category,
                    "base_price": base_price,
                    "capacity": capacity,
                    "event_date": event_date,
                    "sale_opens": sale_opens,
                }
            )
            idx += 1
    return events


# --- Wallet pools ---


def build_wallets():
    bots = [eth_address(f"bot-{i}") for i in range(BOT_WALLET_COUNT)]
    scalpers = [eth_address(f"scalper-{i}") for i in range(SCALPER_WALLET_COUNT)]
    normals = [eth_address(f"user-{i}") for i in range(NORMAL_WALLET_COUNT)]
    return bots, scalpers, normals


# --- Transaction generators ---


def gen_normal_tx(wallet, event, idx):
    """A typical human buyer: 1-4 tickets, no markup, succeeds."""
    days_before = random.randint(1, 45)
    ts = event["event_date"] - timedelta(
        days=days_before,
        hours=random.randint(0, 23),
        minutes=random.randint(0, 59),
        seconds=random.randint(0, 59),
    )
    count = random.choices([1, 2, 3, 4], weights=[50, 30, 15, 5])[0]
    price = event["base_price"]
    # Humans have slight price fluctuation from dynamic pricing
    price_paid = round(price * random.uniform(0.95, 1.05), 2)

    # Normal users occasionally fail (payment issues, timeout ~2%)
    status = "SUCCESS" if random.random() > 0.02 else "FAILED"

    noise = random.gauss(0, 3)
    risk = clamp(5 + noise)

    return {
        "transaction_hash": eth_hash(f"tx-norm-{idx}-{wallet[:10]}"),
        "wallet_address": wallet,
        "event_id": event["event_id"],
        "transaction_type": "PURCHASE",
        "status": status,
        "timestamp": ts.strftime("%Y-%m-%d %H:%M:%S.%f"),
        "ticket_count": count,
        "price_paid": round(price_paid * count, 2),
        "original_event_price": price,
        "markup_pct": 0.0,
        "ip_hash": ip_hash(f"ip-norm-{wallet[:12]}"),
        "is_resale": False,
        "scalping_label": 0,
        "fraud_label": 0,
        "risk_score": round(risk, 1),
    }


def gen_scalper_tx(wallet, event, idx):
    """Scalper: buys several tickets, sometimes resells at markup."""
    is_resale = random.random() < 0.45

    if is_resale:
        txn_type = "RESALE_LISTING"
        days_before = random.randint(1, 20)
        count = random.choices([1, 2, 3], weights=[40, 40, 20])[0]
        markup = random.uniform(0.15, 1.8)
        price = round(event["base_price"] * (1 + markup), 2)
    else:
        txn_type = "PURCHASE"
        days_before = random.randint(5, 50)
        count = random.choices([2, 3, 4, 5, 6], weights=[15, 25, 30, 20, 10])[0]
        markup = 0.0
        price = event["base_price"]

    ts = event["event_date"] - timedelta(
        days=days_before,
        hours=random.randint(0, 23),
        minutes=random.randint(0, 59),
        seconds=random.randint(0, 59),
    )
    status = "SUCCESS"

    # Scalpers: moderate-to-high risk depending on markup & volume
    base_risk = 25 + markup * 15 + count * 3
    noise = random.gauss(0, 5)
    risk = clamp(base_risk + noise)

    # Scalping label: probabilistic (high markup or high volume = likely flagged)
    scalping_score = markup * 0.4 + (count / 6) * 0.4 + random.uniform(0, 0.2)
    scalping_label = 1 if scalping_score > 0.45 else 0

    return {
        "transaction_hash": eth_hash(f"tx-scalp-{idx}-{wallet[:10]}"),
        "wallet_address": wallet,
        "event_id": event["event_id"],
        "transaction_type": txn_type,
        "status": status,
        "timestamp": ts.strftime("%Y-%m-%d %H:%M:%S.%f"),
        "ticket_count": count,
        "price_paid": round(price * count, 2),
        "original_event_price": event["base_price"],
        "markup_pct": round(markup * 100, 2),
        "ip_hash": ip_hash(f"ip-scalp-{wallet[:12]}"),
        "is_resale": is_resale,
        "scalping_label": scalping_label,
        "fraud_label": 0,
        "risk_score": round(risk, 1),
    }


def gen_bot_tx(wallet, event, idx):
    """Bot: rapid attempts, high ticket counts, many failures."""
    txn_type = random.choices(
        ["PURCHASE_ATTEMPT", "PURCHASE"], weights=[65, 35]
    )[0]
    status = random.choices(["FAILED", "SUCCESS", "PENDING"], weights=[50, 35, 15])[0]

    # Bots target events that just opened or are about to sell out
    days_before = random.randint(0, 10)
    # Bots often operate in tight time windows (seconds apart)
    ts = event["sale_opens"] + timedelta(
        days=random.randint(0, 3),
        hours=random.randint(0, 4),
        minutes=random.randint(0, 10),
        seconds=random.randint(0, 59),
    )

    count = random.choices(
        [1, 5, 8, 10, 15, 20], weights=[5, 15, 25, 25, 20, 10]
    )[0]
    price = event["base_price"]

    # Very high risk
    base_risk = 65 + count * 1.5
    if status == "FAILED":
        base_risk += 10
    if txn_type == "PURCHASE_ATTEMPT":
        base_risk += 5
    noise = random.gauss(0, 6)
    risk = clamp(base_risk + noise)

    # Fraud label: probabilistic
    fraud_score = 0.6 + (count / 20) * 0.2 + (0.1 if status == "FAILED" else 0)
    fraud_label = 1 if fraud_score + random.uniform(-0.15, 0.15) > 0.55 else 0

    # Some bots also scalp
    scalping_label = 1 if random.random() < 0.3 else 0

    return {
        "transaction_hash": eth_hash(f"tx-bot-{idx}-{wallet[:10]}"),
        "wallet_address": wallet,
        "event_id": event["event_id"],
        "transaction_type": txn_type,
        "status": status,
        "timestamp": ts.strftime("%Y-%m-%d %H:%M:%S.%f"),
        "ticket_count": count,
        "price_paid": round(price * count, 2) if status == "SUCCESS" else 0.0,
        "original_event_price": price,
        "markup_pct": 0.0,
        "ip_hash": ip_hash(f"ip-bot-{wallet[:12]}"),
        "is_resale": False,
        "scalping_label": scalping_label,
        "fraud_label": fraud_label,
        "risk_score": round(risk, 1),
    }


# --- Main assembly ---


def generate_dataset():
    events = build_events()
    bots, scalpers, normals = build_wallets()

    rows = []

    # Distribution: ~77% normal, ~15% scalper, ~8% bot (matches real-world rates)
    n_normal = int(N_ROWS * 0.77)
    n_scalper = int(N_ROWS * 0.15)
    n_bot = N_ROWS - n_normal - n_scalper

    for i in range(n_normal):
        wallet = random.choice(normals)
        event = random.choice(events)
        rows.append(gen_normal_tx(wallet, event, i))

    for i in range(n_scalper):
        wallet = random.choice(scalpers)
        event = random.choice(events)
        rows.append(gen_scalper_tx(wallet, event, i))

    for i in range(n_bot):
        wallet = random.choice(bots)
        event = random.choice(events)
        rows.append(gen_bot_tx(wallet, event, i))

    # Sort chronologically
    rows.sort(key=lambda r: r["timestamp"])
    return rows


def write_csv(rows, path):
    import csv

    os.makedirs(os.path.dirname(path), exist_ok=True)
    fieldnames = [
        "transaction_hash",
        "wallet_address",
        "event_id",
        "transaction_type",
        "status",
        "timestamp",
        "ticket_count",
        "price_paid",
        "original_event_price",
        "markup_pct",
        "ip_hash",
        "is_resale",
        "scalping_label",
        "fraud_label",
        "risk_score",
    ]
    with open(path, "w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)


def main():
    print("Assembling blockchain_ticketing_master.csv ...")
    rows = generate_dataset()
    write_csv(rows, OUTPUT_FILE)

    # Summary stats
    total = len(rows)
    fraud = sum(1 for r in rows if r["fraud_label"] == 1)
    scalp = sum(1 for r in rows if r["scalping_label"] == 1)
    resale = sum(1 for r in rows if r["is_resale"])
    failed = sum(1 for r in rows if r["status"] == "FAILED")
    scores = [r["risk_score"] for r in rows]

    print(f"\nGenerated {total} transactions -> {OUTPUT_FILE}")
    print(f"  Fraud-labelled:    {fraud} ({fraud/total*100:.1f}%)")
    print(f"  Scalping-labelled: {scalp} ({scalp/total*100:.1f}%)")
    print(f"  Resale txns:       {resale} ({resale/total*100:.1f}%)")
    print(f"  Failed txns:       {failed} ({failed/total*100:.1f}%)")
    print(f"  Risk score range:  {min(scores):.1f} – {max(scores):.1f}")
    print(f"  Risk score mean:   {sum(scores)/len(scores):.1f}")


if __name__ == "__main__":
    main()
