# 🤖 Rexell - ML Lifecycle

This flowchart describes the monthly offline training pipeline for the XGBoost bot-detection model, starting from raw PostgreSQL tables to real-time A/B candidate deployments.

```mermaid
flowchart LR
    PG[("PostgreSQL<br/>behavioral_data + risk_scores")]
    DP["data_prep.py<br/>70/15/15 parquet split"]
    TM["train_model.py<br/>XGBoost (n=250, depth=6)"]
    QG{"Quality gates<br/>acc ≥ 0.95<br/>FPR < 0.02"}
    S3[("MinIO / S3")]
    DEP["deploy_model.py"]
    INF["Inference Service"]
    AB["ABRouter<br/>auto-rollback"]
    Alert[("RabbitMQ alert<br/>bot-detection-alerts")]

    PG --> DP --> TM --> QG
    QG -- pass --> S3 --> DEP --> INF --> AB
    QG -- fail --> Alert
```
