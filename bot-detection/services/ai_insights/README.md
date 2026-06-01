# Rexell AI Insights Service

FastAPI microservice that adapts the AI components from the
[CryptoAI](https://github.com/VanshKapoor07/CryptoAI) reference project to the
Rexell ticketing domain:

| Feature | Adapted from | What it does |
|---------|--------------|--------------|
| **Resale-price / demand forecasting** | CryptoAI LSTM (`more_than_hour/app_1.py`, Binance/ccxt) | LSTM trained on Rexell transaction history predicts the expected resale **markup ratio** → a suggested resale price band (in cUSD) and a demand trend. |
| **Knowledge assistant (RAG)** | CryptoAI RAG (`rag/app.py`, Wikipedia + LangChain) | Retrieval-augmented Q&A over Rexell docs + event context. Answers questions about events, tickets, resale rules and bot detection. |

> News-sentiment (CryptoAI `app2.py`, 774M GPT-2) is intentionally **out of
> scope** for this service (optional Phase 2).

## Design: always-on with graceful degradation

Heavy ML libraries are imported **lazily** so the service always boots:

- **Forecast** uses the trained Keras LSTM when `models/resale_lstm.keras` is
  present; otherwise it falls back to data-driven heuristics from
  `models/event_stats.json` (committed) — never failing closed.
- **RAG** uses sentence-transformer embeddings when available, else keyword
  retrieval. Answers are LLM-synthesized when `HUGGINGFACEHUB_API_TOKEN` is
  set, else a concise extractive answer is returned.

## Endpoints

| Method | Path | Auth | Body |
|--------|------|------|------|
| GET | `/health` | no | — |
| POST | `/v1/forecast/resale-price` | `X-API-Key` | `{ "eventId": "EVT_048", "originalPrice": 100 }` |
| POST | `/v1/forecast/demand` | `X-API-Key` | `{ "eventId": "EVT_048", "horizonDays": 7 }` |
| POST | `/v1/ask` | `X-API-Key` | `{ "question": "How does resale work?" }` |

## Run locally

```bash
cd bot-detection/services
python -m venv .venv && source .venv/bin/activate
pip install -r ai_insights/requirements.txt

# (optional) train the LSTM on Rexell data -> models/
python -m ai_insights.forecast.train --epochs 20

# start the service (dev auth key: dev-ai-insights-key)
AI_INSIGHTS_DEV_MODE=true uvicorn ai_insights.app:app --port 8200
```

```bash
curl -s -X POST localhost:8200/v1/forecast/resale-price \
  -H "X-API-Key: dev-ai-insights-key" -H "Content-Type: application/json" \
  -d '{"eventId":"EVT_048","originalPrice":100}'
```

Or via Docker Compose (from `bot-detection/docker`): `docker compose up ai-insights`.

## Configuration (env)

| Var | Default | Purpose |
|-----|---------|---------|
| `AI_INSIGHTS_API_KEY` / `AI_INSIGHTS_API_KEYS` | — | Accepted `X-API-Key` value(s) |
| `AI_INSIGHTS_DEV_MODE` | `true` | Enables the insecure `dev-ai-insights-key` when no keys configured |
| `HUGGINGFACEHUB_API_TOKEN` | — | Enables LLM-synthesized RAG answers (Mistral-7B by default) |
| `AI_INSIGHTS_DATASET_CSV` | `dataset/blockchain_ticketing_master.csv` | Training data |
| `AI_INSIGHTS_MODEL_DIR` | `./models` | Model + stats artifacts |

## Frontend wiring

The Next.js app calls this service through same-origin proxy routes (which
inject the API key server-side):

- `frontend/app/api/ai/forecast/route.ts` → `/v1/forecast/*`
- `frontend/app/api/ai/assistant/route.ts` → `/v1/ask`

UI: `frontend/components/AI/ResalePriceSuggestion.tsx` (resell page) and
`frontend/components/AI/Assistant.tsx` (global chat widget). Configure the
frontend with `AI_INSIGHTS_BASE_URL` and `AI_INSIGHTS_API_KEY`.

## Tests

```bash
cd bot-detection/services && python -m pytest ai_insights/tests -q
```
