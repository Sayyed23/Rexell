import json
import numpy as np
import tensorflow as tf
import tensorflowjs as tfjs
import os

# Load Data
with open("ml/training_data.json", "r") as f:
    raw_data = json.load(f)

# Preprocess
X = []
y = []

for item in raw_data:
    features = [
        item["time_since_last_buy"],
        item["purchase_count_10s"],
        item["event_diversity_24h"]
    ]
    X.append(features)
    y.append(item["label"])

X = np.array(X)
y = np.array(y)

# Normalize Data (Simple Min-Max scaling logic for demo, hardcoded ranges)
# time_since_last_buy: 0 to 3600
# purchase_count_10s: 0 to 10
# event_diversity_24h: 0 to 20
X[:, 0] = X[:, 0] / 3600.0
X[:, 1] = X[:, 1] / 10.0
X[:, 2] = X[:, 2] / 20.0

# Build Model
model = tf.keras.Sequential([
    tf.keras.layers.Dense(16, activation='relu', input_shape=(3,)),
    tf.keras.layers.Dense(8, activation='relu'),
    tf.keras.layers.Dense(1, activation='sigmoid')
])

model.compile(optimizer='adam', loss='binary_crossentropy', metrics=['accuracy'])

# Train
print("Training model...")
model.fit(X, y, epochs=10, batch_size=32, validation_split=0.2)

# Save Model to TFJS format
output_path = "public/ai_model"
if not os.path.exists(output_path):
    os.makedirs(output_path)

tfjs.converters.save_keras_model(model, output_path)
print(f"Model saved to {output_path}")
