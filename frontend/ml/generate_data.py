import json
import random
import time

# Feature definitions:
# 1. time_since_last_buy (seconds): Time delta from previous purchase. Low = Bot/Scalper.
# 2. purchase_count_10s (count): Number of purchases in last 10 seconds. High = Bot.
# 3. event_diversity_24h (count): Number of different events bought in last 24h. High = Scalper.

NUM_SAMPLES = 5000

data = []

for _ in range(NUM_SAMPLES):
    is_bot = random.random() < 0.3  # 30% bots/scalpers in dataset

    if is_bot:
        # Bot/Scalper Behavior
        time_since_last_buy = random.uniform(0.1, 5.0)  # Very fast buying
        purchase_count_10s = random.randint(2, 10)      # High burst
        event_diversity_24h = random.randint(3, 20)     # Buying everything
        label = 1
    else:
        # Normal User Behavior
        time_since_last_buy = random.uniform(60.0, 3600.0) # Slow buying
        purchase_count_10s = random.randint(0, 1)          # Low burst
        event_diversity_24h = random.randint(0, 2)         # Focused interest
        label = 0

    # Add some noise/overlap to make it realistic
    if random.random() < 0.05:
         time_since_last_buy = random.uniform(0.1, 60.0)

    data.append({
        "time_since_last_buy": time_since_last_buy,
        "purchase_count_10s": purchase_count_10s,
        "event_diversity_24h": event_diversity_24h,
        "label": label
    })

with open("ml/training_data.json", "w") as f:
    json.dump(data, f, indent=2)

print(f"Generated {NUM_SAMPLES} samples in ml/training_data.json")
