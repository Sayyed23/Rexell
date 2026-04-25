# Rexell Bot Detection — End-to-End Integration Guide

This guide walks you through running the full Rexell bot-detection
platform locally, pointing the Next.js frontend at it, and exercising
every detection feature from the web-app UI.

> Everything below assumes a clone of this repo at `/home/ubuntu/repos/Rexell`.
> Adjust paths if your checkout is elsewhere.

- [0. Architecture at a glance](#0-architecture-at-a-glance)
- [1. Prerequisites](#1-prerequisites)
- [2. Start the backend stack](#2-start-the-backend-stack)
- [3. Start the frontend (Next.js)](#3-start-the-frontend-nextjs)
- [4. Wiring the SDK into the web app](#4-wiring-the-sdk-into-the-web-app)
- [5. Feature-by-feature usage](#5-feature-by-feature-usage)
- [6. ML training & retraining](#6-ml-training--retraining)
- [7. Monitoring & alerts](#7-monitoring--alerts)
- [8. Kubernetes deployment](#8-kubernetes-deployment)
- [9. Load & scenario testing](#9-load--scenario-testing)
- [10. Troubleshooting](#10-troubleshooting)

---

## 0. Architecture at a glance

```
                          ┌────────────────────────┐
                          │   Next.js Frontend     │
                          │  (frontend/, :3000)    │
                          │  uses lib/bot-detection│
                          └──────────┬─────────────┘
                                     │ POST /v1/detect, /v1/consume-token,
                                     │ /v1/resale-check, DELETE /v1/user-data
                                     ▼
  ┌─────────────────────┐   ┌──────────────────────┐   ┌─────────────────────┐
  │ Detection Service   │──▶│  ML Inference        │   │ Challenge Service    │
  │ FastAPI :8000       │   │  FastAPI :8080       │   │ FastAPI :8001        │
  └──────┬──────────────┘   └──────────┬───────────┘   └──────────┬──────────┘
         │                             │                           │
         ▼                             ▼                           ▼
  ┌──────────────────────────────────────────────────────────────────┐
  │ PostgreSQL 15  │  Redis 7  │  RabbitMQ 3  │  MinIO (S3-compatible)│
  └──────────────────────────────────────────────────────────────────┘
```

- **Detection Service** (`services/detection/`) — public entrypoint. Validates
  API keys, rate-limits per key, runs the ML + reputation risk-scoring
  pipeline, issues / validates / consumes HMAC verification tokens,
  enforces resale-flag and trusted-status logic.
- **Challenge Service** (`services/challenge/`) — generates and verifies
  image-selection / behavioural / multi-step challenges for medium-risk
  users.
- **ML Inference Service** (`services/inference/`) — loads the XGBoost
  model from MinIO and exposes `POST /predictions`.
- **Shared library** (`services/shared/src/shared/`) — SQLAlchemy models,
  repositories, config, privacy helpers, fallback controller, metrics,
  retention/archival jobs, resale analyser.
- **Training pipeline** (`services/training/`) — monthly retraining
  job invoked by a Kubernetes CronJob.
- **SDK** (`bot-detection/sdk/`) — TypeScript behavioural tracker +
  HTTP client + React challenge components.

---

## 1. Prerequisites

| Tool | Version | Why |
|------|---------|-----|
| Docker + Docker Compose v2 | latest | Runs Postgres / Redis / RabbitMQ / MinIO |
| Python | 3.11+ | Detection / Challenge / Inference / Training services |
| Poetry **or** `pip` | latest | Installs `services/shared/` and its deps |
| Node.js | 20+ | Frontend + SDK |
| pnpm | 9+ | Frontend package manager (repo already uses pnpm) |
| `k6` (optional) | 0.50+ | Load tests |
| `kubectl` + `kustomize` (optional) | latest | Cluster deploy |

Ports the backend uses locally: 5432 (Postgres), 6379 (Redis), 5672/15672
(RabbitMQ), 9000/9001 (MinIO), 8000 (Detection), 8001 (Challenge),
8080 (Inference), 3000 (Next.js).

---

## 2. Start the backend stack

### 2.1 Infrastructure (Postgres / Redis / RabbitMQ / MinIO)

```bash
cd /home/ubuntu/repos/Rexell/bot-detection
docker compose -f docker/docker-compose.yml up -d
```

Wait for the four health checks to pass:

```bash
docker compose -f docker/docker-compose.yml ps
```

### 2.2 Install Python dependencies

```bash
cd /home/ubuntu/repos/Rexell/bot-detection/services/shared
pip install -e .
pip install -r ../detection/requirements.txt
pip install -r ../inference/requirements.txt
pip install -r ../training/requirements.txt
```

### 2.3 Run database migrations

```bash
cd /home/ubuntu/repos/Rexell/bot-detection/services/shared
export DATABASE_URL="postgresql+asyncpg://rexell_user:rexell_password@localhost:5432/bot_detection"
alembic upgrade head
```

### 2.4 Environment variables

Put the following in `bot-detection/.env` (referenced by each service's
`Settings` via `pydantic-settings`):

```env
# Databases / caches / queues
DATABASE_URL=postgresql+asyncpg://rexell_user:rexell_password@localhost:5432/bot_detection
REDIS_URL=redis://localhost:6379/0
RABBITMQ_URL=amqp://rexell_user:rexell_password@localhost:5672/

# Service URLs
ML_INFERENCE_URL=http://localhost:8080

# API keys (comma-separated — issue one per integration)
DETECTION_API_KEYS=dev-key-1,dev-key-2
CHALLENGE_API_KEYS=dev-key-1,dev-key-2

# Crypto / hashing
TOKEN_SIGNING_KEY=replace-with-32-byte-hex-or-random
WALLET_SALT=replace-with-random-salt

# Risk thresholds (defaults shown)
RISK_THRESHOLD_BLOCK=80
RISK_THRESHOLD_CHALLENGE=50

# Optional: activate fallback controller
FALLBACK_CONTROLLER_ENABLED=true

# MinIO (archival + model artefacts)
MINIO_ENDPOINT=localhost:9000
MINIO_ACCESS_KEY=rexell_admin
MINIO_SECRET_KEY=rexell_password
MINIO_SECURE=false
MINIO_MODEL_BUCKET=bot-detection-models
MINIO_ARCHIVE_BUCKET=bot-detection-archive
```

For local experimentation you can instead set `DETECTION_DEV_MODE=true`
and `CHALLENGE_DEV_MODE=true`, which enables an insecure default key so
you don't have to manage API keys. **Never use dev mode in staging or
prod.**

### 2.5 Start the three FastAPI services (three terminals)

```bash
# Terminal 1: Detection
cd /home/ubuntu/repos/Rexell/bot-detection
export PYTHONPATH=$(pwd)/services/shared/src:$(pwd)/services
set -a && source .env && set +a
uvicorn services.detection.app:app --host 0.0.0.0 --port 8000 --reload
```

```bash
# Terminal 2: Challenge
cd /home/ubuntu/repos/Rexell/bot-detection
export PYTHONPATH=$(pwd)/services/shared/src:$(pwd)/services
set -a && source .env && set +a
uvicorn services.challenge.app:app --host 0.0.0.0 --port 8001 --reload
```

```bash
# Terminal 3: ML Inference (placeholder model until you train one)
cd /home/ubuntu/repos/Rexell/bot-detection
export PYTHONPATH=$(pwd)/services/shared/src:$(pwd)/services
set -a && source .env && set +a
uvicorn services.inference.handler:app --host 0.0.0.0 --port 8080 --reload
```

### 2.6 Smoke-test the backend

```bash
# Health
curl -s http://localhost:8000/v1/health | jq
curl -s http://localhost:8001/v1/health | jq
curl -s http://localhost:8080/v1/health | jq

# Detection round-trip
curl -s -X POST http://localhost:8000/v1/detect \
  -H "Content-Type: application/json" \
  -H "X-API-Key: dev-key-1" \
  -d '{
    "behavioralData": {
      "sessionId": "sess-1",
      "walletAddress": "0x0000000000000000000000000000000000000001",
      "userAgent": "Mozilla/5.0 Chrome/124",
      "ipAddress": "127.0.0.1",
      "events": []
    },
    "context": {"accountAgeDays": 30, "transactionCount": 5, "requestedQuantity": 1}
  }' | jq
```

A successful response looks like:

```json
{ "decision": "challenge", "riskScore": 60.0, "challengeId": "…", "challengeType": "image_selection" }
```

---

## 3. Start the frontend (Next.js)

```bash
cd /home/ubuntu/repos/Rexell/frontend
pnpm install
```

Add the following to `frontend/.env.local`:

```env
NEXT_PUBLIC_BOT_DETECTION_URL=http://localhost:8000
NEXT_PUBLIC_BOT_DETECTION_KEY=dev-key-1
```

Run the dev server:

```bash
pnpm dev
```

The app is available at <http://localhost:3000>. Tracking and
`guardPurchase` calls are made from the browser straight to the
Detection Service — CORS is already enabled in the FastAPI middleware,
but if you run the browser against a non-localhost origin you will
need to allow-list it explicitly.

---

## 4. Wiring the SDK into the web app

The frontend ships a tiny integration layer at
`frontend/lib/bot-detection/` that wraps the SDK behaviour tracker +
HTTP client.

### 4.1 Start the tracker once per session

Put this in your wallet-connected layout (e.g. the
`app/(application)/layout.tsx` root) so every route below it is covered:

```tsx
'use client';
import { useAccount } from 'wagmi';
import { useBotDetection } from '@/lib/bot-detection/useBotDetection';

export default function ApplicationLayout({ children }: { children: React.ReactNode }) {
  const { address } = useAccount();
  useBotDetection({
    sessionId: 'rexell-web',
    walletAddress: address,
    enabled: Boolean(address)
  });
  return <>{children}</>;
}
```

The hook is a no-op until the wallet is connected; it detaches the
listeners when the component unmounts.

### 4.2 Gate ticket purchases (`buyTicket`, `buyTickets`)

Inside `app/(application)/event-details/[index]/page.tsx`, wrap the
existing `writeContractAsync` call:

```tsx
import { getBotDetection } from '@/lib/bot-detection';

async function buyTicket(e: React.FormEvent<HTMLFormElement>) {
  e.preventDefault();
  if (!isConnected) return toast.error('Please connect your wallet');
  if (!event) return;

  const bd = getBotDetection();
  const result = await bd.guardPurchase({
    action: 'buyTicket',
    eventId: String(event[0]),
    quantity: 1,
    accountAgeDays: 30,             // compute from on-chain history
    transactionCount: 5
  });

  if (result.decision === 'block') {
    return toast.error('Request blocked by bot detection');
  }
  if (result.decision === 'challenge') {
    // render the React challenge component (see §4.3)
    setPendingChallenge(result);
    return;
  }

  // result.decision === 'allow' — include the token in a downstream API call
  // or skip if you're calling the contract directly
  const tx = await writeContractAsync({ /* ... */ });

  if (result.verificationToken) {
    await bd.consumeToken(result.verificationToken, tx);
  }
}
```

For `buyTickets` pass `action: 'buyTickets'` and `quantity: n`. The
request body will set `isBulkPurchase=true`, which the risk scorer
uses as a feature.

### 4.3 Render the challenge UI

When `guardPurchase` returns `decision === 'challenge'`, mount the
React challenge from the SDK:

```tsx
import {
  ChallengeContainer,
  ChallengeContent
} from '@rexell/bot-detection-sdk/react';
import { BotDetectionClient } from '@rexell/bot-detection-sdk';

const client = new BotDetectionClient({
  apiUrl: process.env.NEXT_PUBLIC_BOT_DETECTION_URL!,
  apiKey: process.env.NEXT_PUBLIC_BOT_DETECTION_KEY!
});

<ChallengeContainer
  client={client}
  challengeId={pending.challengeId!}
  sessionId="rexell-web"
  walletAddress={address!}
  content={pending.challengeContent as ChallengeContent}
  onSuccess={(token) => {
    setPendingChallenge(null);
    submitPurchase(token);
  }}
  onFailure={(reason, attemptsRemaining) =>
    toast.error(`${reason} (${attemptsRemaining} attempts left)`)
  }
/>
```

The container picks the right sub-component (`ImageSelectionChallenge`,
`BehavioralConfirmationChallenge`, or `MultiStepChallenge`) from
`content.type`.

### 4.4 Gate resale flows

```tsx
const bd = getBotDetection();
const status = await bd.checkResale(address!, String(ticketId));
if (status?.requiresAdditionalVerification) {
  toast.error('This wallet must pass an extra challenge before reselling');
  return;
}

// Otherwise call guardPurchase with action: 'resale'
const result = await bd.guardPurchase({ action: 'resale', quantity: 1 });
```

`checkResale` records a hit in the rolling 60-second window. If a
wallet exceeds `RESALE_FLAG_THRESHOLD` (3 hits by default), the
backend flips `flagged=true` on `user_reputation` and all subsequent
resale attempts get `requiresAdditionalVerification: true` until an
admin clears the flag.

### 4.5 GDPR / CCPA deletion

```tsx
await fetch(`${process.env.NEXT_PUBLIC_BOT_DETECTION_URL}/v1/user-data`, {
  method: 'DELETE',
  headers: {
    'Content-Type': 'application/json',
    'X-API-Key': process.env.NEXT_PUBLIC_BOT_DETECTION_KEY!
  },
  body: JSON.stringify({ walletAddress: address })
});
```

The endpoint deletes every row tied to that wallet hash across the
`behavioral_data`, `risk_scores`, `challenge_state`, and
`user_reputation` tables and writes an audit-log entry recording the
accessor and row counts.

---

## 5. Feature-by-feature usage

| Feature | Endpoint | UI trigger |
|---------|----------|------------|
| Risk-based decision (allow / challenge / block) | `POST /v1/detect` | Every gated action |
| Verification token issue | returned by `/v1/detect` | Automatic |
| Verification token validate | `POST /v1/validate-token` | Called before you submit a write transaction |
| Verification token consume | `POST /v1/consume-token` | Call **once** after your tx mines |
| Image-selection / multi-step challenge | rendered in the UI, verified via `POST /v1/verify-challenge` | `decision === 'challenge'` |
| Resale flagging / trusted status | `POST /v1/resale-check` | Resale page and the `/resale/list` flow |
| User-data deletion | `DELETE /v1/user-data` | Privacy-settings page |
| Prometheus metrics | `GET /metrics` (scraped) | Grafana |
| Fallback mode | automatic | Activated by the controller when Redis / DB health fails |
| Synthetic bot/human traffic | `SyntheticTrafficGenerator` | Test harness only |
| Scenario replay | `ScenarioReplay` store | Testing only |

### Token lifecycle

1. `POST /v1/detect` returns `decision: allow` and a
   `verificationToken` (HMAC-SHA256, 5 minute expiry).
2. Frontend passes the token along with the chain write (or a follow-up
   API call).
3. Before doing the work server-side, call `POST /v1/validate-token`
   with `{ token, walletAddress }`.
4. Once the work has finished (tx hash known), call `POST
   /v1/consume-token` with `{ token, txHash }`. The token is marked
   used so it can't be replayed.

### Risk score interpretation

| Range | Decision | Meaning |
|-------|----------|---------|
| `< RISK_THRESHOLD_CHALLENGE` (default 50) | `allow` | Let it through |
| `>= 50 && < RISK_THRESHOLD_BLOCK` | `challenge` | Image / multi-step UI |
| `>= RISK_THRESHOLD_BLOCK` (default 80) | `block` | Reject with 403-style error |

---

## 6. ML training & retraining

The training pipeline lives at `services/training/`.

### 6.1 Prepare data

```bash
cd /home/ubuntu/repos/Rexell/bot-detection
export PYTHONPATH=$(pwd)/services/shared/src
set -a && source .env && set +a
python -m services.training.data_prep
```

Writes `train.parquet / val.parquet / test.parquet` to a temp
directory (prints the path).

### 6.2 Train

```bash
python -m services.training.train_model \
  --train /tmp/training-…/train.parquet \
  --val   /tmp/training-…/val.parquet \
  --test  /tmp/training-…/test.parquet \
  --output-dir /tmp/model-v1.0.0 \
  --version v1.0.0
```

Writes `model.joblib`, `metrics.json`, `metadata.json`. The script
enforces:

- `accuracy ≥ 0.95`
- `false_positive_rate < 0.02`

If either gate fails the script exits with status 1 and (if
`RABBITMQ_URL` is set) publishes a `model_quality_gate_failed` message
on the `bot-detection-alerts` queue.

### 6.3 Deploy a model

Upload artefacts to MinIO and restart the Inference Service so it
picks them up:

```bash
python -m services.inference.deploy_model --version v1.0.0
# or run the full monthly job:
python -m services.training.cronjob
```

Point the Inference Service at a specific version:

```bash
export MODEL_VERSION=v1.0.0
uvicorn services.inference.handler:app --host 0.0.0.0 --port 8080
```

### 6.4 A/B rollouts

`services/inference/ab_router.py` supports routing a fraction of
traffic to a new model. If the new variant's accuracy falls
`rollback_degradation` (5% default) below the control over a 48h
window, `should_rollback()` returns `True` and you should call
`rollback()` to reset `weight` to 0.

### 6.5 Monthly retrain CronJob

`k8s/base/training-cronjob.yaml` schedules the whole pipeline as
`0 2 1 * *` (02:00 UTC on the 1st of every month).

---

## 7. Monitoring & alerts

### 7.1 Prometheus

Point Prometheus at `monitoring/prometheus/prometheus.yml`. The config
scrapes `/metrics` on detection:8000, challenge:8001 and
ml-inference:8080, and loads the alerting rules from
`monitoring/prometheus/alerts.yml`:

- `HighBotDetectionRate` — block+challenge rate > 20% for 10 min
- `ServiceErrorRateWarning` / `…Critical` — error rate thresholds
- `MLInferenceLatencyHigh` — p95 > 500 ms
- `FallbackModeActive` — fallback mode on
- `ModelAccuracyDegraded` — deployed model accuracy < 0.9

### 7.2 Grafana

Import the two dashboards under `monitoring/grafana/dashboards/`:

- `operational.json` — request volume, error rate, latency p50/p95/p99,
  fallback-mode indicator
- `detection.json` — detection rate, risk-score histogram heatmap,
  challenge completion rate, model accuracy

Notification routing is pre-configured in
`monitoring/grafana/notification-channels.yaml`.

### 7.3 Daily summary report

```bash
python /home/ubuntu/repos/Rexell/bot-detection/monitoring/daily_report.py
```

Queries the Prometheus HTTP API for the last 24 h and uploads a JSON
summary to MinIO under `{bucket}/{YYYY/MM/DD}/summary.json` (prints to
stdout when MinIO is not configured).

---

## 8. Kubernetes deployment

### 8.1 Images

```bash
cd /home/ubuntu/repos/Rexell/bot-detection
docker build -f docker/Dockerfile.detection  -t ghcr.io/rexell/bot-detection:latest .
docker build -f docker/Dockerfile.challenge  -t ghcr.io/rexell/bot-detection-challenge:latest .
docker build -f docker/Dockerfile.inference  -t ghcr.io/rexell/bot-detection-inference:latest .
docker build -f docker/Dockerfile.training   -t ghcr.io/rexell/bot-detection-training:latest .
```

### 8.2 Manifests

```bash
# Dev (single replica)
kubectl apply -k k8s/overlays/dev

# Staging
kubectl apply -k k8s/overlays/staging

# Production (4 replicas of detection + inference, HPA up to 20)
kubectl apply -k k8s/overlays/production
```

Each overlay creates the `bot-detection-{dev,staging,prod}` namespace,
deployments for detection/challenge/ml-inference, HPAs, StatefulSets
for Postgres / Redis / RabbitMQ / MinIO, and three CronJobs:

- `training-monthly` — `0 2 1 * *`
- `retention-daily`  — `0 3 * * *`
- `archival-daily`   — `0 4 * * *`

### 8.3 Secrets

`k8s/base/secrets.yaml` has placeholders only. Replace them with
SealedSecrets / Vault / SOPS in real clusters. The services expect:

- `DATABASE_URL`, `REDIS_URL`, `RABBITMQ_URL`
- `TOKEN_SIGNING_KEY`, `WALLET_SALT`
- `API_KEYS` (comma-separated)
- `MINIO_ACCESS_KEY`, `MINIO_SECRET_KEY`

---

## 9. Load & scenario testing

### 9.1 k6

```bash
cd /home/ubuntu/repos/Rexell/bot-detection/loadtest/k6
k6 run normal.js    -e API_URL=http://localhost:8000 -e API_KEY=dev-key-1
k6 run peak.js      -e API_URL=http://localhost:8000 -e API_KEY=dev-key-1
k6 run spike.js     -e API_URL=http://localhost:8000 -e API_KEY=dev-key-1
k6 run sustained.js -e API_URL=http://localhost:8000 -e API_KEY=dev-key-1
```

Thresholds enforced by every script:

- `http_req_duration` p99 < 300 ms
- `http_req_failed` < 0.1 %

### 9.2 Synthetic traffic from Python

```python
from shared.testing_mode import SyntheticTrafficGenerator, TrafficMix
from bot_detection_sdk_smoke import post_detect  # pseudo-code

for label, payload in SyntheticTrafficGenerator(seed=42).generate(
    TrafficMix(sessions=200, bot_fraction=0.3)
):
    response = post_detect(payload)
    assert (label == "bot") == (response["decision"] in {"block", "challenge"})
```

### 9.3 Scenario replay

Every detection request tagged with `X-Test-Mode: true` is stored in
the `ScenarioReplay` instance held by `app.state.scenarios`. Run the
same scenario multiple times to debug flaky edge cases without
regenerating traffic.

---

## 10. Troubleshooting

| Symptom | Likely cause / fix |
|---------|--------------------|
| `401 Unauthorized` from `/v1/detect` | Missing or wrong `X-API-Key`. Check `DETECTION_API_KEYS` and `NEXT_PUBLIC_BOT_DETECTION_KEY`. |
| `429 Too Many Requests` | You hit the 100 req/s / 200 burst limit. Implement exponential backoff (the SDK already does). |
| `503 Service Unavailable` + fallback mode | Redis / Postgres health check is failing. The controller has set `fallback:active` in Redis. Restore the dependency, then `redis-cli del fallback:active`. |
| Detection returns `decision: challenge` for everything | ML Inference Service is down. Detection falls back to the conservative default score (60). Bring inference back up. |
| `Model failed quality gate` | Training metrics below `accuracy ≥ 0.95` / `fpr < 0.02`. Retrain on fresher data or loosen the gates via env var for a one-off experiment. |
| Tokens rejected with `expired` | 5-minute TTL — regenerate by re-calling `/v1/detect`. |
| Frontend `CORS error` | Add your origin to the FastAPI `CORS_ALLOW_ORIGINS` env var. |
| `RuntimeError: No API keys configured` | Set `DETECTION_API_KEYS=…` in `.env` (or `DETECTION_DEV_MODE=true` for local only). |
| `403` from `/v1/user-data` | The endpoint requires a valid API key too — it is not an unauthenticated public endpoint. |

Logs are structured JSON (`structlog` + `python-json-logger`). Every
request is tagged with a correlation ID returned in the
`X-Correlation-ID` response header, so grep `grep <cid>` on the logs
to trace a single request across services.
