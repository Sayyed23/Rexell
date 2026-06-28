# Rexell Scalper & Bot Detection AI Model Plan

> **Dynamic Plan Slug:** `scalper-legit-model.md`  
> **Project Type:** BACKEND (AI/ML Inference & Training Service)

---

## 📋 1. Overview

### Problem Statement
Currently, the Rexell Bot Detection AI engine (`CNN.ipynb` and `services/training/train_model.py`) trains exclusively on a binary target (`label`: 0 = Human, 1 = Bot) using 10 high-frequency behavioral biometrics (e.g., mouse velocity, curvature, flight time). However, on-chain ticket resale fraud is frequently driven by **human scalpers** (`label` = 0, `scalper` = 1) and **bot scalpers** (`label` = 1, `scalper` = 1) who pass standard bot biometrics but exhibit predatory purchasing patterns (e.g., instant ticket selection, high requested quantities, extreme resale markup).

### Proposed Solution
Implement a **Multi-Target / Multi-Task AI Detection Architecture** that captures both:
1. **Automated Bot Telemetry** (`label`: 0 vs 1) via high-fidelity motor control biometrics.
2. **Scalper Account Intent** (`scalper`: 0 = Legit Buyer vs 1 = Scalper) via hybrid biometric and transactional intent features (`account_age_days`, `markup_pct`, `ticket_count`, `navigation_entropy`).

---

## 🎯 2. Success Criteria & Quality Gates

To clear production quality gates (`Task 18.3`), the trained estimators must satisfy:

| Metric | Bot Detection Head (`label`) | Scalper Detection Head (`scalper`) | Verification Method |
| :--- | :--- | :--- | :--- |
| **Minimum Accuracy** | $\ge 94.0\%$ | $\ge 93.0\%$ | Stratified Test Set Evaluation (`metrics.json`) |
| **Maximum FPR** | $< 4.0\%$ | $< 5.0\%$ | Confusion Matrix FPR Calculation |
| **Precision** | $\ge 92.0\%$ | $\ge 90.0\%$ | Scikit-Learn Classification Report |
| **Recall / F1-Score** | $\ge 90.0\%$ | $\ge 90.0\%$ | Scikit-Learn Classification Report |
| **Runtime Inference** | $< 15\text{ms}$ | $< 15\text{ms}$ | On-CPU batch inference benchmark |

---

## 🛠️ 3. Tech Stack & Decision Rationale

- **Runtime & Language:** Python 3.10+ (standardized for data pipeline & model services).
- **Core ML Frameworks:** 
  - **XGBoost (`XGBClassifier`):** Selected for tabular production inference due to robust handling of non-linear feature interactions and missing JS telemetry.
  - **PyTorch (`torch.nn`):** Selected for exploratory multi-head neural architecture (`CNN.ipynb`) to evaluate shared biometric representation learning.
- **Data Manipulation:** `pandas`, `pyarrow` (Parquet fast I/O), `numpy`.
- **Validation & Serialization:** `scikit-learn` (`StandardScaler`, `train_test_split`), `joblib`.

---

## 📁 4. File Structure & Target Changes

```plaintext
d:/Rexell/bot-detection/
├── ai_model_training/
│   └── CNN.ipynb                     # [MODIFY] Add Multi-Task PyTorch MLP/CNN & Dual XGBoost training cells
└── services/
    └── training/
        ├── train_model.py            # [MODIFY] Update _load_splits & train() for dual targets & metrics
        ├── run_local_training.py     # [MODIFY] Include scalper telemetry features & execute dual training
        └── models/                   # [NEW/OUTPUT] Persist bot_model.joblib, scalper_model.joblib & dual metrics.json
```

---

## 📝 5. Task Breakdown

### Phase 1: ANALYSIS & DISCOVERY (Current Phase - Phase 0 Gate)
- **Task 1.1:** Map existing dataset columns in `behavioral_telemetry_dataset.parquet` to verify presence of `scalper` intent labels alongside `label`.
  - *INPUT:* `dataset/behavioral_telemetry_dataset.parquet`
  - *OUTPUT:* Confirmed feature schema (`scalper`, `ticket_count`, `accountAgeDays`, `markup_pct`).
  - *VERIFY:* Parquet metadata inspection confirms non-null target distributions.

### Phase 2: PLANNING & ARCHITECTURE DESIGN (This Artifact)
- **Task 2.1:** Formulate execution plan and submit through **Global Socratic Gate**.
  - *INPUT:* User prompt & codebase analysis.
  - *OUTPUT:* `scalper-legit-model.md` and `implementation_plan.md`.
  - *VERIFY:* User explicit review and approval of technical approach and feature subsets.

### Phase 3: SOLUTIONING (Pre-Code Blueprinting)
- **Task 3.1:** Define exact FeatureVectors for both detection heads.
  - *Bot Head Features ($X_{\text{bot}}$):* 10 motor control biometrics (`mouse_velocity_mean`, `curvature`, `flight_time`, etc.).
  - *Scalper Head Features ($X_{\text{scalper}}$):* Hybrid biometrics + Intent telemetry (`ticket_count`, `account_age_days`, `navigation_entropy`, `dwell_time_mean`, `page_dwell_time_dist`).

### Phase 4: IMPLEMENTATION (Code Execution after Approval)
- **Task 4.1: Update `CNN.ipynb` Model Academy Notebook**
  - *Agent:* `backend-specialist` | *Skill:* `python-patterns`
  - *INPUT:* Existing notebook structure.
  - *OUTPUT:* Added cells implementing `DualTargetXGBoost` pipeline and `MultiTaskMLP` PyTorch module predicting `[pred_bot, pred_scalper]`.
  - *VERIFY:* Notebook executes cleanly end-to-end without runtime errors and prints summary comparison table.
- **Task 4.2: Refactor Production Training Service (`train_model.py`)**
  - *Agent:* `backend-specialist` | *Skill:* `clean-code`, `api-patterns`
  - *INPUT:* `train_model.py`
  - *OUTPUT:* Updated training loop that fits both `bot_model.joblib` and `scalper_model.joblib`, evaluating quality gates for both heads independently.
  - *VERIFY:* Unit tests / dry-run execution confirms generation of dual-head `metrics.json`.
- **Task 4.3: Update Local Training Orchestrator (`run_local_training.py`)**
  - *Agent:* `backend-specialist` | *Skill:* `python-patterns`
  - *INPUT:* `run_local_training.py`
  - *OUTPUT:* Updated feature extraction pipeline passing scalper telemetry to `train_model.train()`.
  - *VERIFY:* Execution of `python run_local_training.py` returns exit code 0 and logs `SUCCESS: Model passed quality gate`.

---

## ✅ Phase X: Final Verification Suite

Before marking the implementation complete, execute the master validation suite:

```bash
# 1. Syntax, Lint & Type Audit
python .agent/scripts/checklist.py .

# 2. Execute Production Training Verification Pipeline
python d:/Rexell/bot-detection/services/training/run_local_training.py --model-type xgboost

# 3. Verify Generated Artefacts
# Check presence and validity of:
# - services/training/models/model.joblib (or bot_model / scalper_model)
# - services/training/models/metrics.json (checking accuracy >= 0.94, FPR < 0.04)
```

### Completion Checklist
- [ ] Code Quality: Clean code principles adhered to (no over-engineering).
- [ ] Socratic Gate: User feedback integrated into model target design.
- [ ] Quality Gate: Both Bot and Scalper models achieve required accuracy and FPR thresholds.
