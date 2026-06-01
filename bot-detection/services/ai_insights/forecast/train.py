"""Train the resale-price forecasting LSTM on Rexell transaction history.

Uses an LSTM model to forecast the next *markup ratio* (price_paid /
original_event_price) from a sliding window of recent transactions.

Outputs (written to ``models/``):
- ``resale_lstm.keras``     — the trained Keras model
- ``resale_scaler.json``    — min/max scaler params (portable, no pickle)
- ``event_stats.json``      — per-event stats + global fallback

Run:
    python -m forecast.train            # from the ai-insights service dir
    python forecast/train.py --epochs 30
"""

import argparse
import json
import sys
from pathlib import Path

# Allow running as a script (python forecast/train.py) or module.
if __package__ in (None, ""):
    sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
    from forecast import features as F  # type: ignore
    from config import settings  # type: ignore
else:
    from . import features as F
    from ..config import settings


def main() -> None:
    parser = argparse.ArgumentParser(description="Train Rexell resale-price LSTM")
    parser.add_argument("--csv", default=str(settings.DATASET_CSV))
    parser.add_argument("--epochs", type=int, default=25)
    parser.add_argument("--batch-size", type=int, default=32)
    parser.add_argument("--out", default=str(settings.MODEL_DIR))
    args = parser.parse_args()

    import numpy as np
    import tensorflow as tf

    out_dir = Path(args.out)
    out_dir.mkdir(parents=True, exist_ok=True)

    print(f"Loading transactions from {args.csv}")
    rows = F.load_rows(args.csv)
    print(f"Loaded {len(rows)} rows")

    # ---- stats + fallback (always written, even if model training is skipped)
    event_stats = F.build_event_stats(rows)
    global_stats = F.global_fallback(rows)
    with open(out_dir / settings.EVENT_STATS_FILE, "w") as fh:
        json.dump({"events": event_stats, "global": global_stats}, fh, indent=2)
    print(f"Wrote event stats for {len(event_stats)} events")

    # ---- sequences
    X, y = F.build_sequences(rows)
    if len(X) < 50:
        print("Not enough sequence data to train an LSTM; stats-only mode.")
        return

    X_arr = np.array(X, dtype="float32")
    y_arr = np.array(y, dtype="float32")

    lo = float(min(X_arr.min(), y_arr.min()))
    hi = float(max(X_arr.max(), y_arr.max()))
    span = (hi - lo) or 1.0
    with open(out_dir / settings.SCALER_FILE, "w") as fh:
        json.dump({"min": lo, "max": hi}, fh, indent=2)

    Xs = (X_arr - lo) / span
    ys = (y_arr - lo) / span
    Xs = Xs.reshape(Xs.shape[0], Xs.shape[1], 1)

    model = tf.keras.Sequential(
        [
            tf.keras.layers.Input(shape=(F.WINDOW, 1)),
            tf.keras.layers.LSTM(32, return_sequences=True),
            tf.keras.layers.LSTM(16),
            tf.keras.layers.Dense(8, activation="relu"),
            tf.keras.layers.Dense(1),
        ]
    )
    model.compile(optimizer="adam", loss="mse", metrics=["mae"])
    model.fit(
        Xs,
        ys,
        epochs=args.epochs,
        batch_size=args.batch_size,
        validation_split=0.1,
        verbose=2,
    )

    model_path = out_dir / settings.LSTM_MODEL_FILE
    model.save(str(model_path))
    print(f"Saved model -> {model_path}")
    print(f"Saved scaler -> {out_dir / settings.SCALER_FILE}")


if __name__ == "__main__":
    main()
