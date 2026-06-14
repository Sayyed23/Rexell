# Rexell — ML / DL training notebooks

End-to-end training pipeline for the Rexell bot-detection model described in
[`.kiro/specs/rexell-ai-bot-detection-integration/design.md`](../.kiro/specs/rexell-ai-bot-detection-integration/design.md)
and [`tasks.md` §18](../.kiro/specs/rexell-ai-bot-detection-integration/tasks.md).

## Layout

```
ml-training/
├── notebooks/
│   ├── 01_data_exploration.ipynb          EDA, class balance, leakage check
│   ├── 02_feature_engineering.ipynb       30-dim FeatureVector, 70/15/15 split
│   ├── 03_classical_ml.ipynb              LogReg, RF, XGBoost, LightGBM, IsolationForest
│   ├── 04_deep_learning_mlp.ipynb         PyTorch & Keras MLP on tabular features
│   ├── 05_deep_learning_sequence.ipynb    PyTorch & Keras Conv1D+BiLSTM on mouse/keystroke streams
│   └── 06_evaluation_and_export.ipynb     side-by-side comparison, threshold tuning, export
├── src/rexell_ml/                         shared helpers imported by every notebook
├── models/                                trained artifacts (gitignored)
├── reports/                               auto-generated metric tables / plots (gitignored)
├── data/                                  cached parquet splits (gitignored)
└── requirements.txt
```

## Datasets

Sourced from [`../dataset/`](../dataset/):

| File | Rows | Target |
|---|---|---|
| `blockchain_ticketing_master.csv` | 12,005 | `scalping_label` (10.4 %), `fraud_label` (6.0 %) |
| `synthetic_ticketing_dataset.csv` | 5,000 | `scalper` |

`risk_score` is **derived from** the labels and excluded as a feature to avoid leakage.

## Quick start

```bash
python -m venv .venv-ml && source .venv-ml/bin/activate
pip install -r ml-training/requirements.txt
jupyter lab ml-training/notebooks
```

Then run the notebooks in numerical order — each is idempotent and can be re-executed
top-to-bottom from a fresh kernel.

## Quality gates (Property 8)

The selected production model must satisfy **both**:

- accuracy ≥ 95 %
- false-positive rate < 2 %

`06_evaluation_and_export.ipynb` enforces this and refuses to export a winner that
fails the gate.

## MinIO upload (production only)

The notebooks write models to `ml-training/models/`. The production training
CronJob ([`bot-detection/services/training/`](../bot-detection/services/training/))
uploads them to `s3://bot-detection-models/models/{semver}/`. To upload a notebook-trained
model manually:

```bash
aws --endpoint-url $MINIO_URL s3 cp \
  ml-training/models/winner.joblib \
  s3://bot-detection-models/models/v$(date +%Y.%m.%d)/model.pkl
```

## Notes

- The DL **sequence** notebook trains on **synthetic** mouse / keystroke streams generated
  by `src/rexell_ml/synth.py`, since the production behavioural-biometrics corpus
  doesn't exist yet (it requires live traffic on the deployed Detection Service).
  All synthetic-data sections are clearly marked.
- All compute targets CPU; each notebook caps at <5 min wall-clock on a typical CI box.
