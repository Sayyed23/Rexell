import os
import pandas as pd
import tempfile
import sys

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
# bot-detection/services/training -> repo root
REPO_ROOT = os.path.abspath(os.path.join(SCRIPT_DIR, "..", "..", ".."))

# Add training dir to python path
sys.path.append(SCRIPT_DIR)
import train_model

DATASET_PARQUET = os.path.join(REPO_ROOT, "bot-detection", "dataset", "behavioral_telemetry_dataset.parquet")

def main():
    import argparse
    parser = argparse.ArgumentParser(description="Run local training")
    parser.add_argument("--model-type", default="xgboost", choices=["xgboost", "mlp"])
    args = parser.parse_args()

    print(f"Loading compiled dataset from {DATASET_PARQUET}...")
    df = pd.read_parquet(DATASET_PARQUET)
    print(f"Original shape: {df.shape}")
    
    # 10 Behavioral biometrics + label
    features = [
        "mouse_velocity_mean", "mouse_velocity_std", "mouse_acceleration",
        "mouse_curvature", "click_frequency", "flight_time_mean",
        "flight_time_std", "dwell_time_mean", "navigation_entropy",
        "page_dwell_time_dist", "label"
    ]
    
    df_features = df[features].copy()
    
    # Shuffle and split (70% train, 15% val, 15% test)
    df_features = df_features.sample(frac=1, random_state=42).reset_index(drop=True)
    n = len(df_features)
    n_train = int(n * 0.70)
    n_val = int(n * 0.15)
    
    train_df = df_features.iloc[:n_train]
    val_df = df_features.iloc[n_train:n_train+n_val]
    test_df = df_features.iloc[n_train+n_val:]
    
    print(f"Train split: {len(train_df)} rows")
    print(f"Val split: {len(val_df)} rows")
    print(f"Test split: {len(test_df)} rows")
    
    # Save splits in a temporary directory
    tmpdir = tempfile.mkdtemp(prefix="local-splits-")
    train_path = os.path.join(tmpdir, "train.parquet")
    val_path = os.path.join(tmpdir, "val.parquet")
    test_path = os.path.join(tmpdir, "test.parquet")
    
    train_df.to_parquet(train_path, index=False)
    val_df.to_parquet(val_path, index=False)
    test_df.to_parquet(test_path, index=False)
    
    # Run training
    output_dir = os.path.join(SCRIPT_DIR, "models")
    print(f"Starting {args.model_type.upper()} model training. Outputs will be saved to: {output_dir}")
    
    metrics = train_model.train(
        train_path=train_path,
        val_path=val_path,
        test_path=test_path,
        output_dir=output_dir,
        model_version="v1.1.0-hf",
        log_mlflow=False,
        model_type=args.model_type
    )
    
    print("\nTraining Metrics:")
    print(f"  Accuracy: {metrics.accuracy:.4f} (Min Required: {train_model.QUALITY_MIN_ACCURACY})")
    print(f"  Precision: {metrics.precision:.4f}")
    print(f"  Recall: {metrics.recall:.4f}")
    print(f"  F1 Score: {metrics.f1:.4f}")
    print(f"  False Positive Rate: {metrics.false_positive_rate:.4f} (Max Allowed: {train_model.QUALITY_MAX_FPR})")
    print(f"  Passed Quality Gate: {metrics.passed_quality_gate}")
    
    # Clean up temp splits
    for p in [train_path, val_path, test_path]:
        if os.path.exists(p):
            os.remove(p)
    os.rmdir(tmpdir)
    
    if not metrics.passed_quality_gate:
        print("\nERROR: Model did not pass quality gate!")
        sys.exit(1)
    else:
        print("\nSUCCESS: Model passed quality gate and was trained successfully!")

if __name__ == "__main__":
    main()
