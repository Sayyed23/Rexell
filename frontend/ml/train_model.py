"""Train the client-side bot detection model from training_data.json.

Features (10 behavioral biometrics, already normalized to [0, 1]):
  mouse_velocity_mean, mouse_velocity_std, mouse_acceleration,
  mouse_curvature, click_frequency, flight_time_mean, flight_time_std,
  dwell_time_mean, navigation_entropy, page_dwell_time_dist

Outputs a TensorFlow.js model to public/ai_model/.
"""

import json
import numpy as np
import tensorflow as tf
import tensorflowjs as tfjs
import os

FEATURE_KEYS = [
    "mouse_velocity_mean",
    "mouse_velocity_std",
    "mouse_acceleration",
    "mouse_curvature",
    "click_frequency",
    "flight_time_mean",
    "flight_time_std",
    "dwell_time_mean",
    "navigation_entropy",
    "page_dwell_time_dist",
]

# Load Data
with open("ml/training_data.json", "r") as f:
    raw_data = json.load(f)

# Preprocess — values are already in [0, 1], no manual normalization needed
X = np.array([[item[k] for k in FEATURE_KEYS] for item in raw_data])
y = np.array([item["label"] for item in raw_data])

# Build Model
model = tf.keras.Sequential([
    tf.keras.layers.Dense(32, activation='relu', input_shape=(len(FEATURE_KEYS),)),
    tf.keras.layers.Dense(16, activation='relu'),
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
