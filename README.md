<!-- REXELL ROOT README (1000+ LINES - AUTHORITATIVE EDITION) -->
<h1 align="center">💠 REXELL 💠</h1>

<p align="center">
  <b>Web3 Platform for Events</b><br>
  Revolutionizing event ticketing with blockchain technology.
</p>

<details>
<summary> Table of Contents</summary>

- [About the Project](#about-the-project)
- [High-Level Architecture](#high-level-architecture)
- [Frontend](#-frontend)
- [Blockchain / Smart Contracts](#-blockchain--smart-contracts)
- [AI / ML Anti-Scalping Engine](#-aiml-anti-scalping-engine)
- [Storage & Data Layer](#-storage--data-layer)
- [DevOps & Deployment](#-devops--deployment)
- [Application Flow](#-application-flow)
- [Project Plan](#-project-plan)
- [Gantt Chart](#-gantt-chart)
- [Risk & Mitigation](#-risk--mitigation)
- [Tech Stack Summary](#-tech-stack-summary)
- [Resale Functionality](#resale-functionality)
- [Installation and Setup](#installation-and-setup)
- [Running Bot Detection Stack](#-running-bot-detection-stack)

</details>

## About the Project

**Summary**: Rexell is a blockchain-based platform where users can create events and buy NFT tickets, tackling ticket scalping and enhancing trust. 

**Problem Statement**: The traditional event ticketing industry faces numerous challenges, including ticket scalping, fraud, and lack of transparency. These issues undermine trust and can result in significant financial losses for both event organizers and attendees. Additionally, there is often no reliable way to verify the authenticity of an event, leaving buyers unsure of the legitimacy of the events they plan to attend.

**Solution**: Rexell offers a blockchain-based platform where users can create events and purchase tickets that are issued as Non-Fungible Tokens (NFTs). This innovative approach ensures that each ticket is unique, verifiable, and secure, addressing the problems of ticket scalping and fraud. By recording transactions on the blockchain, Rexell provides a transparent and immutable record of ticket ownership and event details.

### Objectives
- **Eliminate Ticket Scalping and Fraud**: Implement blockchain technology to issue tickets as NFTs, ensuring their authenticity and preventing duplication or counterfeit tickets.
- **Enhance Trust and Transparency**: Provide a transparent platform where all transactions and ticket ownership are recorded on the blockchain, fostering trust among users.
- **Simplify Event Creation and Management**: Offer a user-friendly interface for event organizers to create and manage their events, streamlining the process of selling tickets.

### Scope
- **Event Creation and Management**: Users can create, manage, and promote their events on the Rexell platform. Event organizers will have access to tools for tracking ticket sales and managing attendees.
- **NFT Ticketing System**: All tickets will be issued as NFTs, providing a secure and verifiable method of ticket distribution. This system will prevent ticket scalping and fraud by ensuring each ticket is unique and traceable.
- **Blockchain-Based Transactions**: All ticket sales and transfers will be recorded on the blockchain, ensuring transparency and immutability of all transactions.
- **User-Friendly Interface**: The platform will be designed with a focus on usability, ensuring a seamless experience for both event organizers and attendees.
- **Resale Functionality**: Users can resell their tickets through a verification process that prevents scalping.

#### Additional Features
- **Rating Section**: There is a section where only those who bought the tickets rate how the event was. This section only works after the event has passed.
- **Interact Section**: There is a section where ticket holders can interact by posting comments. Ticket holders can also use this section to give feedback on how the event was.
- **Anti-Scalping Resale System**: Users can resell tickets only after organizer verification to prevent scalping.

---

## High-Level Architecture

```mermaid
graph TB
    subgraph User["🧑 User"]
        Browser["Browser / MetaMask"]
    end

    subgraph Frontend["⚛️ Frontend — Next.js 14"]
        UI["React 18 + TailwindCSS"]
        RK["RainbowKit Wallet UI"]
        WG["Wagmi + Viem"]
        AI_FE["AI Mode Service"]
        API["Next.js API Routes"]
    end

    subgraph Blockchain["⛓️ Celo Blockchain"]
        RC["Rexell.sol — ERC-721"]
        SB["SoulboundIdentity.sol"]
        CUSD["cUSD Stablecoin"]
    end

    subgraph Storage["💾 Storage"]
        IPFS["Pinata — IPFS"]
        LS["LocalStorage"]
    end

    subgraph AIML["🤖 AI / ML Layer (in-browser agents)"]
        BD["Bot Detector"]
        SD["Scalping Detector"]
        RA["Risk Evaluation Agent"]
        PA["Policy Enforcement Agent"]
        CNN["CNN Model — TensorFlow"]
    end

    subgraph BotDet["🛡️ Bot Detection Microservices"]
        SDK["Behavioral SDK<br/>· Mouse/keystroke telemetry<br/>· ≥20 Hz sampling"]
        DET["Detection Service<br/>FastAPI :8000"]
        CHA["Challenge Service<br/>FastAPI :8001"]
        INF["ML Inference<br/>FastAPI :8080"]
        TRN["Training CronJob"]
        PG[("Postgres<br/>Risk scores")]
        RD[("Redis<br/>Rate limit / resale")]
        MQ[("RabbitMQ<br/>Alerts")]
        S3[("MinIO / S3<br/>Models, archives")]
    end

    subgraph Deploy["🚀 Deployment"]
        Vercel["Vercel"]
        Celoscan["Celoscan Explorer"]
        K8s["Kubernetes (k8s/overlays)"]
        Prom["Prometheus + Grafana"]
    end

    Browser --> UI
    UI --> RK --> WG
    WG --> RC
    WG --> SB
    RC --> CUSD
    UI --> AI_FE
    AI_FE --> BD & SD
    BD & SD --> RA --> PA
    UI --> SDK
    SDK -->|telemetry, token req| DET
    DET --> INF
    DET --> PG & RD
    DET --> CHA
    CHA --> PG
    TRN -->|joblib model| S3
    INF -->|load model| S3
    DET -->|alerts| MQ
    DET --> Prom
    API --> IPFS
    UI --> LS
    Frontend --> Vercel
    BotDet --> K8s
    RC --> Celoscan
    CNN -.->|Training Data| BD
```

---

## ⚛️ Frontend

The frontend is a **Next.js 14** application using the **App Router** pattern with **React 18** and **TypeScript**.

### Core Framework

| Technology | Version | Purpose |
|---|---|---|
| **Next.js** | 14.2.3 | React meta-framework (SSR, API Routes, App Router) |
| **React** | 18.x | Component-based UI library |
| **TypeScript** | 5.x | Static type checking |

### Styling & UI

| Technology | Version | Purpose |
|---|---|---|
| **TailwindCSS** | 3.4.1 | Utility-first CSS framework |
| **Radix UI** (shadcn/ui) | Various | Accessible, unstyled component primitives |
| **Lucide React** | 0.376.0 | Icon library |
| **Sonner** | 1.4.41 | Toast notification system |
| **next-themes** | 0.3.0 | Dark / light theme toggling |
| **class-variance-authority** | 0.7.0 | Component variant management |
| **tailwind-merge** | 2.3.0 | Tailwind class conflict resolution |
| **tailwindcss-animate** | 1.0.7 | Animation utilities |

#### Radix UI Primitives Used

`Accordion` · `Avatar` · `Dropdown Menu` · `Label` · `Menubar` · `Popover` · `Select` · `Slot`

### Web3 / Blockchain Integration

| Technology | Version | Purpose |
|---|---|---|
| **RainbowKit** | 2.0.6 | Wallet connection UI (MetaMask) |
| **Wagmi** | 2.7.1 | React hooks for Ethereum |
| **Viem** | 2.9.29 | Low-level EVM interaction (ABI encoding, contract calls) |
| **@celo/contractkit** | 8.0.0 | Celo-specific transaction helpers |
| **@celo/rainbowkit-celo** | 1.2.0 | Celo chain presets for RainbowKit |
| **ethers.js** | 6.16.0 | Ethereum library (deployment scripts) |
| **web3.js** | 1.10 | Alternative Web3 library |

### Utilities

| Technology | Purpose |
|---|---|
| **@tanstack/react-query** | Async state management & caching |
| **date-fns** | Date formatting and manipulation |
| **qrcode / react-qr-code** | QR code generation for tickets |
| **html-to-image** | Screenshot / export tickets as images |
| **react-day-picker** | Calendar date picker component |
| **react-rating-stars-component** | Star-based event rating |
| **react-icons** | Additional icon sets |
| **@vercel/analytics** | Usage analytics |

### Frontend Directory Structure

```
frontend/
├── app/                    # Next.js App Router
│   ├── (application)/      # Authenticated app pages
│   │   ├── buy/            # Buy tickets
│   │   ├── create-event/   # Create new events
│   │   ├── event-details/  # Event detail view
│   │   ├── events/         # Browse all events
│   │   ├── history/        # Purchase history
│   │   ├── market/         # Marketplace
│   │   ├── my-events/      # Organizer's events
│   │   ├── my-tickets/     # User's tickets
│   │   ├── resale/         # Resale marketplace
│   │   ├── resale-approval/# Organizer approves resale
│   │   └── resell/         # List ticket for resale
│   ├── (marketing)/        # Public landing pages
│   └── api/                # API routes (ai, files)
├── blockchain/             # ABI files & chain config
├── components/             # Reusable React components
│   ├── ui/                 # shadcn/ui primitives
│   ├── landing/            # Landing page sections
│   ├── shared/             # Shared components
│   └── AI/                 # AI mode components
├── lib/                    # Core utilities
│   ├── ai/                 # AI anti-scalping engine
│   │   ├── agents/         # Risk & policy agents
│   │   └── models/         # Bot & scalping detectors
│   ├── web3.ts             # Viem client setup
│   └── celoSepolia.ts      # Custom chain config
├── ml/                     # ML training scripts
├── providers/              # Context providers
│   ├── blockchain-providers.tsx
│   └── theme-provider.tsx
└── public/                 # Static assets
```

---

## ⛓️ Blockchain / Smart Contracts

The project uses **Solidity** smart contracts deployed on the **Celo** blockchain (EVM-compatible, mobile-first, carbon-negative).

### Smart Contract Stack

| Technology | Version | Purpose |
|---|---|---|
| **Solidity** | 0.8.17 | Smart contract language |
| **Hardhat** | 2.22.3 | Development, testing & deployment framework |
| **OpenZeppelin** | 4.9.6 | Audited contract libraries (ERC-721, Ownable, ReentrancyGuard) |
| **@nomicfoundation/hardhat-toolbox** | 5.0.0 | Hardhat plugins bundle |
| **@nomicfoundation/hardhat-ethers** | 3.1.0 | Ethers.js integration for Hardhat |

### Networks

| Network | Chain ID | RPC URL | Explorer |
|---|---|---|---|
| **Celo Mainnet** | 42220 | `https://forno.celo.org` | [celoscan.io](https://celoscan.io) |
| **Celo Sepolia (Testnet)** | 11142220 | `https://celo-sepolia.drpc.org` | [sepolia.celoscan.io](https://sepolia.celoscan.io) |
| **Hardhat (Local)** | 31337 | `http://127.0.0.1:8545` | — |

### Contracts

```mermaid
classDiagram
    class Rexell {
        +ERC721URIStorage
        +Ownable
        +ReentrancyGuard
        --
        +IERC20 cUSDToken
        +SoulboundIdentity identityContract
        +uint royaltyPercent = 5%
        --
        +createEvent()
        +buyTicket()
        +buyTickets()
        +submitRating()
        +addComment()
        +requestResale()
        +approveResale()
        +rejectResale()
        +executeResale()
        +cancelTicket()
    }

    class SoulboundIdentity {
        +ERC721 - Non-Transferable
        +Ownable
        --
        +mapping userToIdentity
        +mapping verificationScores
        +mapping kycTimestamps
        --
        +mintIdentity()
        +updateScore()
        +burnIdentity()
        +hasValidIdentity()
        +getIdentityDetails()
    }

    class cUSD {
        +ERC20
        --
        Celo Stablecoin
        Pegged to 1 USD
    }

    Rexell --> cUSD : "Payments in cUSD"
    Rexell --> SoulboundIdentity : "Identity verification"
```

#### Rexell.sol — Main Contract (742 lines)
- **ERC-721 NFT Tickets** — each ticket is a unique NFT with metadata URI
- **Event CRUD** — create events with name, venue, category, date, price, IPFS image
- **Ticket Purchase** — pay with cUSD (Celo Dollar stablecoin), mint NFT
- **Rating & Comments** — post-event ratings (only after event date) and comments
- **Anti-Scalping Resale** — request → organizer approval → execute with 5% royalty
- **Ownership History** — full on-chain tracking of ticket transfers

#### SoulboundIdentity.sol — Identity Contract (91 lines)
- **Non-Transferable (Soulbound) NFT** — cannot be transferred once minted
- **KYC Verification Score** (0–100) — determines user trustworthiness
- **Identity Validation** — users need score ≥ 70 to be considered verified

---

## 🤖 AI/ML Anti-Scalping Engine

Rexell includes a multi-layered AI system that detects and prevents ticket scalping and bot activity.

### Architecture — Agentic Pipeline

```mermaid
flowchart LR
    subgraph Observation["🔍 Phase 1 — Observation - ML Layer"]
        BD["Bot Detector\n· Rapid-fire purchase detection\n· Time-gap analysis"]
        SD["Scalping Detector\n· Duplicate event tracking\n· Bulk buy patterns"]
    end

    subgraph Decision["🧠 Phase 2 — Decision - Agent Layer"]
        RA["Risk Evaluation Agent\n· Combines bot + scalping scores\n· Computes trust score\n· Identifies dominant risk"]
        PA["Policy Enforcement Agent\n· ALLOW / WARNING / BLOCK\n· Generates user messages"]
    end

    subgraph Action["⚡ Phase 3 — Action"]
        AL["✅ ALLOW — Proceed"]
        WN["⚠️ WARNING — Alert User"]
        BL["🚫 BLOCK — Deny Purchase"]
    end

    BD --> RA
    SD --> RA
    RA --> PA
    PA --> AL & WN & BL
```

### AI Components

| Component | File | Role |
|---|---|---|
| **Bot Detector** | `lib/ai/models/bot-detector.ts` | Analyzes purchase timing patterns to detect automated bots |
| **Scalping Detector** | `lib/ai/models/scalping-detector.ts` | Flags users buying duplicates or bulk tickets for same event |
| **Risk Evaluation Agent** | `lib/ai/agents/risk-agent.ts` | Combines detector scores into a unified trust score |
| **Policy Enforcement Agent** | `lib/ai/agents/policy-agent.ts` | Makes final ALLOW / WARNING / BLOCK decision |
| **AI Mode Service** | `lib/ai/ai-mode.ts` | Orchestrates the full pipeline per purchase attempt |
| **AI Logger** | `lib/ai/logger.ts` | Logs AI decisions for auditing |

### ML Training Pipeline

| File | Language | Purpose |
|---|---|---|
| `ml/generate_data.py` | Python | Generate synthetic training data |
| `ml/train_model.py` | Python | Train ML model (TensorFlow/scikit-learn) |
| `ml/train_model.js` | JavaScript | Alternative JS-based training |
| `dataset/CNN.ipynb` | Jupyter | CNN model experimentation notebook |
| `dataset/assemble_dataset.py` | Python | Assemble and preprocess raw datasets |
| `dataset/blockchain_ticketing_master.csv` | CSV | 2.3 MB master ticketing dataset |

---

## 🛡️ Behavioral Bot Detection Integration (AI Microservices)

In addition to the in-browser agentic engine described above, Rexell ships a production-grade **server-side bot-detection platform** under [`bot-detection/`](bot-detection/) that performs deep behavioral analysis, ML-driven risk scoring, adaptive challenges, and HMAC-signed verification tokens that the smart contracts can require before allowing a purchase.

Full operator manual: [`bot-detection/docs/INTEGRATION_GUIDE.md`](bot-detection/docs/INTEGRATION_GUIDE.md). The summary below explains the architecture, where each piece lives in the repo, and how the AI plugs into the Next.js front-end and the on-chain ticket flow.

### 1. Component Architecture

```mermaid
flowchart LR
    subgraph Browser["🖥️ Next.js (frontend/)"]
        Hook["useBotDetection()<br/>frontend/lib/bot-detection"]
        Track["BehavioralTracker<br/>bot-detection/sdk/src/tracker.ts"]
        Cli["BotDetectionClient<br/>bot-detection/sdk/src/client.ts"]
        Chall["ChallengeContainer<br/>(React)"]
    end

    subgraph Backend["🐳 bot-detection/services"]
        DET["Detection :8000<br/>/v1/detect, /v1/resale-check,<br/>/v1/token/*, /v1/user-data"]
        CHA["Challenge :8001<br/>/v1/challenge, /v1/verify"]
        INF["Inference :8080<br/>/predictions"]
        TRN["Training (CronJob)<br/>data_prep + train_model"]
    end

    subgraph Data["💽 Stateful deps"]
        PG[("PostgreSQL")]
        RD[("Redis")]
        MQ[("RabbitMQ")]
        MINIO[("MinIO / S3")]
    end

    Hook --> Track --> Cli
    Cli -- POST /v1/detect --> DET
    DET -- features --> INF
    INF -- risk score --> DET
    DET -- challenge needed --> CHA
    Cli -- render --> Chall
    Chall -- POST /v1/verify --> CHA
    DET --> PG
    DET --> RD
    DET -- alerts --> MQ
    TRN -- model.joblib --> MINIO
    INF -- load --> MINIO
```

### 2. Repository Layout

```
bot-detection/
├── services/
│   ├── detection/        # FastAPI: /v1/detect, /v1/token/*, /v1/resale-check, /metrics, /v1/user-data
│   │   ├── app.py        # 700+ LOC service entrypoint
│   │   ├── handler.py    # decision pipeline (analyze → score → policy)
│   │   ├── token_validator.py
│   │   ├── rate_limiter.py
│   │   └── auth.py       # API-key middleware (DETECTION_API_KEYS)
│   ├── challenge/        # FastAPI: adaptive challenges (image / behavioral / multi-step)
│   │   ├── app.py
│   │   ├── challenge_engine.py
│   │   └── models.py
│   ├── inference/        # FastAPI: XGBoost model server
│   │   ├── handler.py
│   │   ├── ab_router.py  # A/B variant routing + 48 h auto-rollback
│   │   └── deploy_model.py
│   ├── training/         # Monthly retraining job
│   │   ├── data_prep.py  # builds train/val/test parquet from Postgres
│   │   ├── train_model.py# XGBoost + quality gates (acc ≥ 0.95, FPR < 0.02)
│   │   └── cronjob.py    # entrypoint for K8s CronJob
│   └── shared/           # Library shared by all services
│       └── src/shared/
│           ├── analyzer.py          # behavioral feature extraction
│           ├── risk_scorer.py       # combined risk score
│           ├── resale_analyzer.py   # rolling 60 s window + trusted status
│           ├── fallback.py          # async health-watcher / per-wallet limits
│           ├── privacy.py           # IP /24/48 trunc, UA normalize, PII scrub
│           ├── audit.py             # audit log writer
│           ├── retention.py         # data lifecycle (90 d / 30 d / 7 y)
│           ├── archival.py          # MinIO Parquet/JSONL.gz archival
│           ├── metrics.py           # Prometheus metrics + decision counters
│           ├── testing_mode.py      # synthetic traffic + scenario replay
│           ├── clients/             # Postgres / Redis / RabbitMQ / MinIO clients
│           ├── db/                  # SQLAlchemy models + Alembic migrations
│           └── models/              # Pydantic event/feature/decision schemas
├── sdk/                   # TypeScript Behavioral SDK (consumed by Next.js)
│   └── src/
│       ├── tracker.ts     # circular buffer, ≥20 Hz mouse RAF sampling, password filter
│       ├── client.ts      # retrying HTTP client (back-off, CORS-safe)
│       ├── types.ts       # EventType, BehavioralData, DecisionResponse
│       ├── index.ts       # public re-exports
│       └── react/         # ChallengeContainer, ImageSelection,
│                          #   BehavioralConfirmation, MultiStep
├── docker/                # Multi-stage Dockerfiles (detection / challenge / inference / training)
│   └── docker-compose.yml # Postgres, Redis, RabbitMQ, MinIO + 3 services
├── k8s/                   # Kubernetes manifests
│   ├── base/              # Namespace, ConfigMap, Secrets, StatefulSets, Deployments,
│   │                      #   HPAs, CronJobs (training / retention / archival)
│   └── overlays/{dev,staging,production}/  # Kustomize overlays
├── monitoring/
│   ├── prometheus/        # prometheus.yml + alerts.yml
│   └── grafana/dashboards/ # operational.json + detection.json
├── loadtest/k6/           # normal / peak / spike / sustained load scenarios
└── docs/INTEGRATION_GUIDE.md   # full step-by-step operator manual

frontend/lib/bot-detection/  # Next.js integration shim that wraps the SDK
├── index.ts                #   BotDetectionIntegration: startTracking, guardPurchase,
│                            #     consumeToken, checkResale (graceful degradation)
├── types.ts
└── useBotDetection.ts      # React hook for per-session activation
```

### 3. Pipeline Stages

| Stage | What happens | Code |
|---|---|---|
| **3.1 Telemetry capture** | `BehavioralTracker.start()` instruments mouse / keystroke / focus / navigation events into a 4096-entry circular buffer at ≥ 20 Hz, masking inputs under `input[type=password]` and credit-card fields. | `bot-detection/sdk/src/tracker.ts` |
| **3.2 Risk request** | On `guardPurchase()`, the SDK posts `{ session_id, wallet_hash, behavioral_data }` to `POST /v1/detect` with retry + exponential back-off. | `bot-detection/sdk/src/client.ts`, `frontend/lib/bot-detection/index.ts` |
| **3.3 Feature extraction** | The Detection service hashes the wallet (`WALLET_SALT`), truncates IP to /24 (IPv4) or /48 (IPv6), normalises the UA to a browser family, then derives 30+ kinematic features (mouse velocity / acceleration / curvature, click cadence, keystroke dwell, navigation entropy). | `services/shared/src/shared/{privacy,analyzer}.py` |
| **3.4 Risk scoring** | Features are sent to the **Inference service** which loads the latest XGBoost model from MinIO and returns `risk_score ∈ [0,100]`. The A/B router (`ab_router.py`) splits traffic between control & candidate variants and auto-rolls back on > 5 % accuracy regression over 48 h. | `services/inference/{handler,ab_router}.py` |
| **3.5 Policy decision** | Detection applies thresholds → `BLOCK ≥ 80`, `CHALLENGE 50–79`, `ALLOW < 50`. The decision is persisted to Postgres and recorded in Prometheus counters. | `services/detection/handler.py`, `services/shared/src/shared/risk_scorer.py` |
| **3.6 Token issuance** | On `ALLOW`, the service mints an HMAC-SHA256 token (5 min TTL) keyed by `TOKEN_SIGNING_KEY` and returns `{ decision, token, expires_at }`. The token is the proof of humanity required by smart-contract calls. | `services/detection/token_validator.py` |
| **3.7 Adaptive challenge** | On `CHALLENGE`, the SDK mounts `<ChallengeContainer/>`. Sub-challenges (image-selection 3-grid, behavioral mouse-gesture, multi-step) are issued by `services/challenge/challenge_engine.py`. A successful `/v1/verify` returns a fresh detection token. | `bot-detection/sdk/src/react/*`, `services/challenge/*` |
| **3.8 Token consumption** | After the on-chain transaction succeeds, the front-end calls `POST /v1/token/consume` so a token can never be replayed. | `services/detection/token_validator.py` |
| **3.9 Resale gating** | Resale flows additionally call `POST /v1/resale-check` which uses a Redis sorted-set rolling 60-second window — > 3 hits within the window flags the wallet, and the **TrustedStatusManager** promotes wallets with ≥ 20 sessions / mean score ≤ 20 / std-dev ≤ 15 / max < 70 over 30 days to relaxed checks. | `services/shared/src/shared/resale_analyzer.py` |
| **3.10 Fallback mode** | An async `FallbackController` polls Postgres / Redis / Inference health. When any dependency is unhealthy it short-circuits `/v1/detect` to safe mode and enforces a hard **2-ticket-per-wallet-per-event** cap so the platform never goes fully open. | `services/shared/src/shared/fallback.py` |
| **3.11 Privacy & GDPR** | Daily retention cleanup deletes behavioral data > 90 days; logs > 30 days; audit logs kept 7 years. `DELETE /v1/user-data` performs full subject erasure across all tables and writes an audit record. Expired rows are archived to MinIO as Parquet (or JSONL.gz fallback) before deletion. | `services/shared/src/shared/{privacy,retention,archival,audit}.py` |
| **3.12 Observability** | Each service exposes `GET /metrics` (request count, latency, decision histogram, model accuracy, fallback flag). Prometheus scrapes at 15 s; Grafana dashboards `operational.json` + `detection.json` visualise everything. Alerts fire on bot-rate > 20 % / 10 min, p95 ML latency > 500 ms, accuracy < 0.9, fallback active. | `services/shared/src/shared/metrics.py`, `monitoring/prometheus/alerts.yml` |

### 4. Public API Surface

| Method | Path | Service | Auth | Purpose |
|---|---|---|---|---|
| `POST` | `/v1/detect` | detection :8000 | API key | Score behavioural data, return `{decision, risk_score, token?}` |
| `POST` | `/v1/token/validate` | detection | API key | Verify token signature + TTL before any sensitive work |
| `POST` | `/v1/token/consume` | detection | API key | Burn a token after a successful tx (replay protection) |
| `POST` | `/v1/resale-check` | detection | API key | Returns `{flagged, requiresAdditionalVerification, trusted}` for resale flows |
| `DELETE` | `/v1/user-data` | detection | API key | GDPR / CCPA subject erasure |
| `GET` | `/metrics` | detection / challenge / inference | none | Prometheus scrape endpoint |
| `POST` | `/v1/challenge` | challenge :8001 | API key | Issue an adaptive challenge for a session |
| `POST` | `/v1/verify` | challenge | API key | Validate user-submitted challenge response |
| `POST` | `/predictions` | inference :8080 | internal | Return `risk_score` for a feature vector |
| `GET` | `/v1/health` | all services | none | Liveness probe |

### 5. Risk Score → Decision Mapping

| Score | Decision | UI behaviour | Token |
|---|---|---|---|
| `< 50` | **ALLOW** | Purchase proceeds | Issued (5 min TTL) |
| `50 – 79` | **CHALLENGE** | `<ChallengeContainer/>` mounts; on success a new token is issued | Issued only after `/v1/verify` |
| `≥ 80` | **BLOCK** | Friendly block screen, no contract call attempted | None |

Additional flags are enforced on top of the score:
* **Rate limit** — sliding window per IP/wallet on `/v1/detect`
* **Resale flag** — `> 3` resale-check requests in 60 s
* **Fallback mode** — `≤ 2` tickets per wallet per event when dependencies are degraded
* **Trusted status** — long-tenured legitimate wallets bypass the resale rate limit

### 6. ML Lifecycle

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

* The **monthly K8s CronJob** (`k8s/base/training-cronjob.yaml`, `0 2 1 * *`) calls `services.training.cronjob`, which runs `data_prep` → `train_model` and uploads artefacts to MinIO.
* `train_model.py` rejects models that don't pass the quality gates and publishes `model_quality_gate_failed` to RabbitMQ; the previous good model stays live.
* `services/inference/ab_router.py` weights traffic between `control` and `candidate` model versions, records per-decision accuracy, and resets the candidate weight to 0 if it regresses by more than 5 % over 48 h.

### 7. Frontend Integration in 4 Lines

```tsx
// frontend/app/(application)/layout.tsx
const bot = useBotDetection({
  apiUrl: process.env.NEXT_PUBLIC_BOT_DETECTION_URL!,
  apiKey: process.env.NEXT_PUBLIC_BOT_DETECTION_KEY!,
});

// before the contract write
const guard = await bot.guardPurchase({ wallet, eventId });
if (guard.decision === 'block')      return showBlocked();
if (guard.decision === 'challenge')  return mountChallenge(guard.challenge);
await writeContractAsync({ /* …, args: [...args, guard.token] */ });
await bot.consumeToken(guard.token);   // burn after success
```

Resale flows additionally call `bot.checkResale({ wallet, ticketId })`. GDPR deletion is a single `DELETE /v1/user-data` call wired up from a user settings page.

Graceful degradation is built in: if the bot-detection backend is unreachable the helper returns `{ decision: 'allow', degraded: true }` so the marketplace never fails closed for genuine users.

### 8. Deployment Topologies

* **Local dev** — `docker compose -f bot-detection/docker/docker-compose.yml up` boots Postgres, Redis, RabbitMQ, MinIO, plus the three FastAPI services.
* **Kubernetes** — `kubectl apply -k bot-detection/k8s/overlays/{dev,staging,production}` deploys StatefulSets for the data plane and HPA-scaled Deployments for the services. Production overlay caps HPA at 20 replicas and pre-provisions 4 base pods.
* **Load testing** — `bot-detection/loadtest/k6/{normal,peak,spike,sustained}.js` runs the four canonical traffic shapes against `/v1/detect` and asserts `p99 < 300 ms` and error rate `< 0.1 %`.

---

## 💾 Storage & Data Layer

Rexell uses a **decentralized storage** approach — no traditional database.

```mermaid
flowchart TB
    subgraph OnChain["⛓️ On-Chain - Celo Blockchain"]
        Events["Events Data"]
        Tickets["NFT Tickets - ERC-721"]
        Ownership["Ticket Ownership History"]
        Ratings["Ratings & Comments"]
        Resale["Resale Requests & Approvals"]
        Identity["Soulbound Identity + KYC Scores"]
    end

    subgraph OffChain["☁️ Off-Chain"]
        IPFS["Pinata — IPFS\n· Event images\n· NFT metadata URIs"]
        LS["Browser LocalStorage\n· AI purchase history\n· AI decision logs"]
    end

    Events --> IPFS
    Tickets --> IPFS
    OnChain <--> OffChain
```

| Layer | Technology | Data Stored |
|---|---|---|
| **On-Chain** | Celo Blockchain | Events, tickets (NFTs), ratings, comments, resale state, identity |
| **IPFS (Pinata)** | Pinata Cloud Gateway | Event images, NFT metadata JSON, ticket artwork |
| **Client-side** | Browser LocalStorage | AI purchase history, decision logs |

---

## 🚀 DevOps & Deployment

| Tool | Purpose |
|---|---|
| **Vercel** | Frontend hosting (Next.js optimized) |
| **Netlify** | Alternative static hosting (config present) |
| **Hardhat** | Smart contract compilation, testing & deployment |
| **Celoscan** | On-chain contract verification & explorer |
| **pnpm** | Package manager |
| **ESLint** | Code linting |
| **Prettier** | Code formatting |
| **PostCSS** | CSS processing pipeline |

### Deployment Flow

```mermaid
flowchart LR
    subgraph Dev["👨‍💻 Development"]
        Code["Write Code"]
        Compile["Hardhat Compile"]
        Test["Hardhat Test"]
    end

    subgraph Deploy["🚀 Deploy"]
        DeploySC["Deploy Contracts\n→ Celo Sepolia / Mainnet"]
        Verify["Verify on Celoscan"]
        UpdateABI["update-abi script\n→ Copy ABI to frontend"]
        DeployFE["Push to Vercel"]
    end

    Code --> Compile --> Test
    Test --> DeploySC --> Verify
    DeploySC --> UpdateABI --> DeployFE
```

---

## 🔁 End-to-End AI Decision Flow

This diagram traces a single ticket purchase through every AI / risk surface in the system — from the moment the user lands on the buy page through the on-chain mint.

```mermaid
sequenceDiagram
    autonumber
    participant U as User
    participant FE as Next.js Frontend
    participant SDK as Behavioral SDK
    participant DET as Detection :8000
    participant INF as Inference :8080
    participant CHA as Challenge :8001
    participant AI as lib/ai (in-browser agents)
    participant SC as Rexell.sol (Celo)

    U->>FE: Visit /buy?event=42
    FE->>SDK: useBotDetection().startTracking()
    SDK-->>FE: collecting mouse/keystroke @ ≥20 Hz
    U->>FE: Click "Buy Ticket"
    FE->>AI: scalpingDetector + botDetector + riskAgent
    AI-->>FE: client-side trust score (fast first pass)
    FE->>SDK: guardPurchase(wallet, eventId)
    SDK->>DET: POST /v1/detect (behavioral_data)
    DET->>INF: POST /predictions (features)
    INF-->>DET: risk_score = 67
    DET->>CHA: issue challenge
    CHA-->>DET: challenge payload
    DET-->>SDK: {decision: "challenge", challenge}
    SDK->>FE: mount <ChallengeContainer/>
    U->>FE: Solve image-selection challenge
    FE->>CHA: POST /v1/verify
    CHA-->>FE: {success: true}
    FE->>DET: POST /v1/detect (with verify_proof)
    DET-->>SDK: {decision: "allow", token: "hmac…"}
    FE->>SC: writeContract buyTicket(eventId, …, token)
    SC-->>FE: tx hash
    FE->>DET: POST /v1/token/consume(token)
    DET-->>FE: ok
    FE-->>U: NFT minted ✅
```

The **lib/ai/** in-browser agents act as a low-latency first-pass filter (no network call), while the **bot-detection microservices** provide the authoritative ML-driven decision and the HMAC-signed token that the smart contract treats as the proof-of-humanity for the actual on-chain mint.

---

## 🔄 Application Flow

### End-to-End User Journey

```mermaid
flowchart TD
    Start(["🧑 User opens Rexell"]) --> Connect["Connect MetaMask Wallet\nvia RainbowKit"]
    Connect --> Landing["Landing Page"]

    Landing --> CreateEvent["📝 Create Event\n· Name, Venue, Category\n· Date, Time, Price\n· Upload image → Pinata IPFS"]
    Landing --> BrowseEvents["🔍 Browse Events"]

    CreateEvent --> SC_Create["Smart Contract\ncreateEvent()"]
    SC_Create --> EventLive["✅ Event Live on Blockchain"]

    BrowseEvents --> EventDetail["View Event Details"]
    EventDetail --> AICheck{"🤖 AI Risk\nAssessment"}

    AICheck -->|"✅ ALLOW"| BuyTicket["💰 Buy Ticket\n· Pay in cUSD\n· Mint NFT"]
    AICheck -->|"⚠️ WARNING"| Warning["Show Warning\nProceed?"]
    AICheck -->|"🚫 BLOCK"| Blocked["Purchase Blocked"]

    Warning -->|Yes| BuyTicket
    BuyTicket --> SC_Buy["Smart Contract\nbuyTicket()"]
    SC_Buy --> NFT["🎫 NFT Ticket Minted\n· Stored in wallet\n· QR Code generated"]

    NFT --> PostEvent{"Event\nPassed?"}
    PostEvent -->|Yes| Rate["⭐ Rate Event"]
    PostEvent -->|Yes| Comment["💬 Post Comments"]
    PostEvent -->|No| Resale["🔄 Request Resale"]

    Resale --> OrgApproval{"Organizer\nApproves?"}
    OrgApproval -->|"✅ Yes"| Execute["Execute Resale\n· 5% Royalty to Organizer\n· Transfer NFT to Buyer"]
    OrgApproval -->|"❌ No"| Rejected["Resale Rejected"]

    Rate --> SC_Rate["Smart Contract\nsubmitRating()"]
    Comment --> SC_Comment["Smart Contract\naddComment()"]
```

---

## 📋 Project Plan

Rexell is developed in **7 phases**:

```mermaid
timeline
    title Rexell Development Roadmap
    Phase 1 : Foundation & Smart Contracts
             : Project setup
             : Rexell.sol & SoulboundIdentity.sol
             : Hardhat testing & Celo Sepolia deployment
    Phase 2 : Frontend & Wallet Integration
             : Next.js 14 App Router setup
             : RainbowKit + Wagmi + MetaMask
             : TailwindCSS + shadcn/ui design system
    Phase 3 : Core Ticketing Features
             : Event creation with IPFS uploads
             : Ticket purchase with cUSD
             : NFT minting & QR code generation
    Phase 4 : AI Anti-Scalping Engine
             : Bot detector & Scalping detector
             : Risk evaluation & Policy agents
             : CNN model training pipeline
    Phase 5 : Resale & Royalty System
             : Resale request & organizer approval
             : 5% royalty enforcement
             : Ownership history tracking
    Phase 6 : Community & Engagement
             : Post-event ratings
             : Comment / interact section
             : Soulbound identity & KYC scoring
    Phase 7 : Testing, Optimization & Deployment
             : End-to-end testing
             : Gas optimization
             : Vercel + Celo Mainnet deployment
```

### Phase 1 — Foundation & Smart Contracts

| # | Task | Tech | Deliverable |
|---|---|---|---|
| 1.1 | Initialize Hardhat project | Hardhat, Node.js, pnpm | `hardhat.config.js`, `package.json` |
| 1.2 | Write `Rexell.sol` | Solidity 0.8.17, OpenZeppelin | ERC-721 contract with event CRUD, ticket minting |
| 1.3 | Write `SoulboundIdentity.sol` | Solidity, OpenZeppelin | Non-transferable ERC-721 identity NFT |
| 1.4 | Write `MockCUSD.sol` | Solidity | Test ERC-20 token for local dev |
| 1.5 | Write unit tests | Hardhat, Chai, Mocha | `test/` directory with full contract coverage |
| 1.6 | Deploy to Celo Sepolia | Hardhat, ethers.js | Deployed contract addresses |
| 1.7 | Verify on Celoscan | hardhat-etherscan | Verified source on Celoscan |
| 1.8 | Create ABI update scripts | TypeScript | `scripts/update-abi.ts` → copies ABI to frontend |

### Phase 2 — Frontend & Wallet Integration

| # | Task | Tech | Deliverable |
|---|---|---|---|
| 2.1 | Initialize Next.js 14 App Router | Next.js, TypeScript, pnpm | `frontend/` directory |
| 2.2 | Set up TailwindCSS + shadcn/ui | TailwindCSS, Radix UI, PostCSS | Design tokens, `components/ui/` |
| 2.3 | Configure theme provider | next-themes | Dark/Light mode toggle |
| 2.4 | Set up RainbowKit + Wagmi | RainbowKit, Wagmi, Viem | `providers/blockchain-providers.tsx` |
| 2.5 | Configure Celo Sepolia chain | Viem | `lib/celoSepolia.ts` custom chain definition |
| 2.6 | Create web3 utility library | Viem | `lib/web3.ts` — public/wallet clients, price formatting |
| 2.7 | Import contract ABIs | TypeScript | `blockchain/abi/rexell-abi.ts`, `soulbound-abi.ts` |
| 2.8 | Build landing page + app layout | React, TailwindCSS | `app/(marketing)/`, header, footer, nav |

### Phase 3 — Core Ticketing Features

| # | Task | Tech | Deliverable |
|---|---|---|---|
| 3.1 | Create Event page | React, Wagmi, Viem | `app/(application)/create-event/page.tsx` |
| 3.2 | Pinata IPFS upload API | Next.js API Routes, Pinata SDK | `app/api/files/route.ts` |
| 3.3 | Browse Events + Event Details | React, Wagmi | Events listing and detail pages |
| 3.4 | Buy Ticket flow | Wagmi, cUSD (ERC-20 approve + contract call) | `app/(application)/buy/page.tsx` |
| 3.5 | NFT ticket minting | Smart contract interaction | ERC-721 minted to buyer wallet |
| 3.6 | QR code generation + ticket export | react-qr-code, html-to-image | QR with metadata, downloadable graphic |
| 3.7 | My Tickets + My Events pages | React, Wagmi | User's tickets and organizer's events |
| 3.8 | Purchase History page | React, Wagmi | `app/(application)/history/page.tsx` |

### Phase 4 — AI Anti-Scalping Engine

| # | Task | Tech | Deliverable |
|---|---|---|---|
| 4.1 | Build Bot Detector model | TypeScript | `lib/ai/models/bot-detector.ts` |
| 4.2 | Build Scalping Detector model | TypeScript | `lib/ai/models/scalping-detector.ts` |
| 4.3 | Build Risk Evaluation Agent | TypeScript | `lib/ai/agents/risk-agent.ts` |
| 4.4 | Build Policy Enforcement Agent | TypeScript | `lib/ai/agents/policy-agent.ts` |
| 4.5 | Build AI Mode orchestrator | TypeScript | `lib/ai/ai-mode.ts` |
| 4.6 | Generate synthetic training data | Python | `ml/generate_data.py` |
| 4.7 | Train CNN model | Python, TensorFlow | `dataset/CNN.ipynb` |
| 4.8 | Integrate AI into buy flow | React, TypeScript | Warning/Block UI before purchase |

### Phase 5 — Resale & Royalty System

| # | Task | Tech | Deliverable |
|---|---|---|---|
| 5.1 | Resale request submission | Wagmi, Viem | User initiates resale with price |
| 5.2 | Resale verification flow | React | `components/ResaleVerification.tsx` |
| 5.3 | Organizer approval dashboard | React, Wagmi | `app/(application)/resale-approval/page.tsx` |
| 5.4 | Resale API routes | Next.js API Routes | `pages/api/resale-*` |
| 5.5 | Execute resale with royalty | Smart Contract | 5% royalty auto-deducted, NFT transferred |
| 5.6 | Resale marketplace page | React | `app/(application)/resale/page.tsx` |
| 5.7 | Ownership history tracking | Smart Contract + UI | `HistoryCard.tsx`, on-chain ownership chain |

### Phase 6 — Community & Engagement

| # | Task | Tech | Deliverable |
|---|---|---|---|
| 6.1 | Post-event rating system | React, Smart Contract | `submitRating()` — only after event date |
| 6.2 | Star rating UI | react-rating-stars-component | Rating display on event page |
| 6.3 | Comment / interact section | React, Smart Contract | `Comment.tsx`, `addComment()` |
| 6.4 | Soulbound Identity minting | Smart Contract, Wagmi | Identity NFT with KYC score |
| 6.5 | Identity verification UI | React | Display verification status, verified badge |

### Phase 7 — Testing, Optimization & Deployment

| # | Task | Tech | Deliverable |
|---|---|---|---|
| 7.1 | Smart contract unit tests | Hardhat, Chai, Mocha | Full test suite in `test/` |
| 7.2 | End-to-end user flow tests | Browser testing | Full buy, resale, rating flows |
| 7.3 | Solidity gas optimization | Hardhat gas reporter, `viaIR: true` | Reduced gas costs |
| 7.4 | Security audit (contracts) | Slither, manual review | Vulnerability report |
| 7.5 | Deploy contracts to Celo Mainnet | Hardhat | Production contract addresses |
| 7.6 | Verify contracts on Celoscan | hardhat-etherscan | Public verification |
| 7.7 | Deploy frontend to Vercel | Vercel CLI / Git push | Production URL |

---

## 📅 Gantt Chart

```mermaid
gantt
    title Rexell Development Timeline
    dateFormat  YYYY-MM-DD
    axisFormat  %b %d

    section Phase 1 — Smart Contracts
    Project Setup               :p1a, 2025-01-01, 3d
    Write Rexell.sol            :p1b, after p1a, 10d
    Write SoulboundIdentity.sol :p1c, after p1a, 5d
    Unit Tests                  :p1d, after p1b, 5d
    Deploy to Sepolia           :p1e, after p1d, 2d
    Verify on Celoscan          :p1f, after p1e, 1d

    section Phase 2 — Frontend Shell
    Next.js + TailwindCSS Setup :p2a, after p1a, 3d
    RainbowKit + Wagmi          :p2b, after p2a, 3d
    Import ABIs + Web3 Utils    :p2c, after p1f, 2d
    Landing Page + Layout       :p2d, after p2b, 5d

    section Phase 3 — Core Ticketing
    Create Event + IPFS         :p3a, after p2c, 5d
    Browse + Event Details      :p3b, after p3a, 4d
    Buy Ticket + NFT Mint       :p3c, after p3b, 5d
    QR Code + My Tickets        :p3d, after p3c, 3d

    section Phase 4 — AI Engine
    Bot + Scalping Detectors    :p4a, after p2c, 5d
    Risk + Policy Agents        :p4b, after p4a, 4d
    ML Training Pipeline        :p4c, after p4a, 7d
    Integrate into Buy Flow     :p4d, after p4b, 3d

    section Phase 5 — Resale System
    Resale Request + Approval   :p5a, after p3c, 5d
    Marketplace + Royalties     :p5b, after p5a, 5d
    Ownership History           :p5c, after p5b, 2d

    section Phase 6 — Community
    Ratings + Comments          :p6a, after p3d, 4d
    Soulbound Identity UI       :p6b, after p6a, 3d

    section Phase 7 — Deployment
    Testing + Security Audit    :p7a, after p5c, 7d
    Gas Optimization            :p7b, after p7a, 3d
    Mainnet Deploy + Verify     :p7c, after p7b, 3d
    Vercel Production Deploy    :p7d, after p7c, 2d
```

---

## 🗺️ Module Dependency Map

```mermaid
flowchart BT
    subgraph Contracts["⛓️ Smart Contracts"]
        RC["Rexell.sol"]
        SB["SoulboundIdentity.sol"]
        CUSD["MockCUSD.sol"]
    end

    subgraph Infra["🔧 Infrastructure"]
        HH["Hardhat Config"]
        Scripts["Deploy / Verify Scripts"]
        ABI["Exported ABIs"]
    end

    subgraph FrontendCore["⚛️ Frontend Core"]
        NX["Next.js App Router"]
        Providers["BlockchainProviders\n RainbowKit + Wagmi"]
        Web3["Web3 Utils\n Viem clients"]
        Theme["Theme Provider"]
    end

    subgraph Features["🎫 Feature Modules"]
        Events["Event Management\n Create, Browse, Details"]
        Tickets["Ticket System\n Buy, My Tickets, QR"]
        ResaleF["Resale Marketplace\n Request, Approve, Execute"]
        Community["Community\n Ratings, Comments"]
        Identity["Identity\n Soulbound, KYC"]
    end

    subgraph AI["🤖 AI Layer"]
        Detectors["Bot + Scalping\nDetectors"]
        Agents["Risk + Policy\nAgents"]
        ML["ML Training\nPipeline"]
    end

    subgraph External["☁️ External Services"]
        Pinata["Pinata IPFS"]
        Celo["Celo Network"]
        MM["MetaMask"]
    end

    RC --> CUSD
    RC --> SB
    HH --> RC & SB
    Scripts --> HH
    ABI --> RC & SB

    NX --> Providers & Theme
    Providers --> Web3
    Web3 --> ABI

    Events --> Web3 & Pinata
    Tickets --> Web3
    ResaleF --> Web3
    Community --> Web3
    Identity --> Web3

    Tickets --> Detectors --> Agents
    ML -.-> Detectors

    Web3 --> Celo
    Providers --> MM
```

---

## ⚠️ Risk & Mitigation

| Risk | Impact | Likelihood | Mitigation |
|---|---|---|---|
| **Smart contract vulnerability** | 🔴 Critical | Medium | OpenZeppelin audited libs, ReentrancyGuard, unit tests, manual audit |
| **Gas costs too high** | 🟡 Medium | Medium | Solidity optimizer (`runs: 200`, `viaIR: true`), batch operations |
| **Scalping bypasses AI** | 🟡 Medium | Low | Multi-layer detection (bot + scalping + agents), on-chain one-resale limit |
| **IPFS gateway downtime** | 🟡 Medium | Low | Pinata dedicated gateway, fallback to `ipfs.io` |
| **MetaMask UX friction** | 🟡 Medium | High | RainbowKit simplifies flow, clear error messages |
| **Celo network congestion** | 🟠 Low | Low | Low gas fees on Celo, transaction retry logic |
| **Private key exposure** | 🔴 Critical | Low | `.env` in `.gitignore`, deployment via secure CI/CD |

---

## 📊 Tech Stack Summary

| Layer | Technologies |
|---|---|
| **Frontend Framework** | Next.js 14, React 18, TypeScript 5 |
| **Styling** | TailwindCSS 3.4, Radix UI / shadcn/ui, Lucide Icons |
| **State Management** | TanStack React Query, React Context |
| **Web3 Client** | Wagmi 2, Viem 2, RainbowKit 2, Celo ContractKit |
| **Wallet** | MetaMask (via RainbowKit) |
| **Blockchain** | Celo (EVM-compatible, Mainnet + Sepolia Testnet) |
| **Smart Contracts** | Solidity 0.8.17, OpenZeppelin 4.9.6 |
| **Token Standard** | ERC-721 (NFT Tickets), ERC-20 (cUSD Payments) |
| **Identity** | Soulbound NFT (Non-Transferable ERC-721) |
| **Dev Framework** | Hardhat 2.22, Ethers.js 6 |
| **AI/ML (client)** | Custom TypeScript agents, Python (TensorFlow, CNN) |
| **AI/ML (server)** | FastAPI · XGBoost · scikit-learn · MLflow (optional) |
| **Bot-Detection Stack** | PostgreSQL · Redis · RabbitMQ · MinIO · Prometheus · Grafana · k6 |
| **Behavioral SDK** | TypeScript SDK + React challenge components (`bot-detection/sdk`) |
| **Storage** | Pinata IPFS (images/metadata), Celo (on-chain data), Postgres + MinIO (bot-detection) |
| **Deployment** | Vercel (frontend), Celoscan (contract verification), Docker + Kubernetes (Kustomize) for bot-detection |
| **Package Manager** | pnpm |
| **Linting & Formatting** | ESLint, Prettier |
| **Analytics** | Vercel Analytics |

---

## Resale Functionality

Rexell includes a comprehensive resale system designed to prevent ticket scalping while allowing legitimate ticket transfers:

1. **Resale Verification**: Users must request verification before reselling tickets
2. **Organizer Approval**: Event organizers must approve all resale requests
3. **Price Control**: Resale prices are visible to organizers
4. **Limited Resales**: Each ticket can only be resold once

For detailed information about the resale functionality, see [RESALE.md](frontend/components/RESALE.md).

## Installation and Setup

### Prerequisites
Ensure you have **Node.js** installed.

### Steps
1. Clone the repository:
   ```bash
   git clone https://github.com/Sayyed23/Rexell
   cd Rexell/frontend
   ```
2. Install dependencies:

    ```bash
    pnpm install
    ```

3. Run the application:

    ```bash
    npm run dev
    ```

---

## 🛠️ Running Bot Detection Stack

The AI bot-detection backend is fully containerised and lives in [`bot-detection/`](bot-detection/). The end-to-end operator manual — including step-by-step copy-paste commands for backend, frontend integration, ML training, Kubernetes deployment, and troubleshooting — is in **[`bot-detection/docs/INTEGRATION_GUIDE.md`](bot-detection/docs/INTEGRATION_GUIDE.md)**.

### Quick start (local Docker)

```bash
# 1. Boot infra (Postgres, Redis, RabbitMQ, MinIO)
docker compose -f bot-detection/docker/docker-compose.yml up -d

# 2. Install Python deps & run migrations
cd bot-detection
pip install -e services/shared -e services/detection -e services/challenge \
            -e services/inference -e services/training
alembic -c services/shared/src/shared/db/alembic.ini upgrade head

# 3. Configure secrets in .env
cat > .env <<'EOF'
DATABASE_URL=postgresql+asyncpg://rexell_user:rexell_password@localhost:5432/bot_detection
REDIS_URL=redis://localhost:6379/0
DETECTION_API_KEYS=dev-key-1,dev-key-2
TOKEN_SIGNING_KEY=change-me-32-bytes-min
WALLET_SALT=another-random-salt
ML_INFERENCE_URL=http://localhost:8080
MINIO_ENDPOINT=localhost:9000
FALLBACK_CONTROLLER_ENABLED=true
EOF

# 4. Start the three FastAPI services in separate terminals
uvicorn services.detection.app:app --port 8000 --reload
uvicorn services.challenge.app:app --port 8001 --reload
uvicorn services.inference.handler:app --port 8080 --reload
```

### Wire it into the Next.js app

```bash
cd frontend
cat >> .env.local <<'EOF'
NEXT_PUBLIC_BOT_DETECTION_URL=http://localhost:8000
NEXT_PUBLIC_BOT_DETECTION_KEY=dev-key-1
EOF
pnpm install
pnpm dev    # → http://localhost:3000
```

Use the `useBotDetection()` hook in your layout, then wrap every smart-contract write with `guardPurchase()` / `consumeToken()` as shown in the ["Frontend Integration in 4 Lines"](#7-frontend-integration-in-4-lines) section above.

### Smoke tests

```bash
# Health
curl localhost:8000/v1/health localhost:8001/v1/health localhost:8080/v1/health

# Risk decision
curl -X POST localhost:8000/v1/detect \
  -H "X-API-Key: dev-key-1" -H "Content-Type: application/json" \
  -d '{"session_id":"s1","wallet_hash":"0xabc","behavioral_data":{"events":[]}}'

# Prometheus scrape
curl localhost:8000/metrics
```

### Production / Kubernetes

```bash
# Build and push images
for svc in detection challenge inference training; do
  docker build -f bot-detection/docker/Dockerfile.$svc -t ghcr.io/sayyed23/rexell-$svc:latest bot-detection
done

# Apply Kustomize overlay (dev / staging / production)
kubectl apply -k bot-detection/k8s/overlays/production
```

### Load testing & monitoring

```bash
# k6 scenarios (normal / peak / spike / sustained)
DETECTION_URL=http://localhost:8000 API_KEY=dev-key-1 \
  k6 run bot-detection/loadtest/k6/normal.js

# Prometheus + Grafana dashboards
# - bot-detection/monitoring/prometheus/{prometheus.yml,alerts.yml}
# - bot-detection/monitoring/grafana/dashboards/{operational,detection}.json
```

For every detail — `.env` reference, ML retraining workflow, GDPR deletion endpoint, A/B model rollouts, troubleshooting table — see [`INTEGRATION_GUIDE.md`](bot-detection/docs/INTEGRATION_GUIDE.md).

---

## 🔬 Smart Contract Technical Specification

### 1. `Rexell.sol` Interface

The primary NFT contract governing ticket issuance and secondary market rules.

**Functions:**

*   `createEvent(string memory _name, uint256 _price, uint256 _totalTickets, uint256 _startTime)`
    *   *Access*: Organizer Role
    *   *Emits*: `EventCreated(uint256 eventId, string name, uint256 price)`
*   `buyTicket(uint256 _eventId, string memory _tokenURI)`
    *   *Access*: Public (Gated by Bot Detection Token)
    *   *Payment*: Required in cUSD via `transferFrom`
    *   *Logic*: Checks `maxTicketsPerWallet`, subtracts from `remainingTickets`.
*   `listTicketForResale(uint256 _ticketId, uint256 _price)`
    *   *Requirement*: `_price <= events[eventId].price * maxResaleMultiplier`
*   `buyResaleTicket(uint256 _ticketId)`
    *   *Automation*: Automatically transfers `royaltyAmount` to Organizer and `sellerProceeds` to Seller.

**Events:**

| Event | Parameters | Rationale |
| :--- | :--- | :--- |
| `TicketMinted` | `(uint256 ticketId, address owner, uint256 eventId)` | Indexing for My Profile page. |
| `ResaleListed` | `(uint256 ticketId, uint256 price)` | Marketplace feed updates. |
| `IdentityVerified` | `(address user, uint256 score)` | Reputation tracking for UI. |

---

## 🗄️ Database Schema & Data Models (Postgres)

The bot-detection services utilize a shared PostgreSQL database with the following critical tables.

### `sessions` (Behavioral Core)
Tracks the lifecycle of a high-risk user session.

| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | UUID (PK) | Primary session identifier. |
| `wallet_address` | VARCHAR(42) | User's wallet (salted/hashed). |
| `risk_score` | FLOAT | Current normalized risk (0.0 - 1.0). |
| `is_bot` | BOOLEAN | Final classification flag. |
| `created_at` | TIMESTAMP | Session start time. |

### `raw_events` (Telemetry Storage)
Stores raw behavioral telemetry for forensics and retraining.

| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | BIGINT (PK) | Auto-incrementing ID. |
| `session_id` | UUID (FK) | Reference to sessions table. |
| `event_type` | VARCHAR(20) | `click`, `mousemove`, `keypress`, `scroll`. |
| `data` | JSONB | Raw payload (coordinates, deltas, fingerprints). |

### `challenges` (Verification Tracking)
Manages the state of interactive bot challenges.

| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | UUID (PK) | Challenge ID. |
| `type` | VARCHAR(10) | `pow`, `image`, `behavioral`. |
| `status` | VARCHAR(15) | `pending`, `solved`, `failed`, `expired`. |
| `payload` | JSONB | Verification tokens and solving metadata. |

---

## ⚛️ Frontend Component Architecture

### Component Hierarchy

```text
app/

├── (auth)/             # Wallet connection and profile routes
├── (discovery)/        # Event marketplace and search
├── (ticketing)/        # Purchase flow and challenge UI
│   ├── [eventId]/
│   │   ├── PurchaseButton.tsx
│   │   ├── BotDetectionGuard.tsx
│   │   └── ChallengeOverlay.tsx
components/
├── shared/             # Atomic design (Button, Card, Input)
├── blockchain/         # Web3 specific components (WalletButton)
├── rexell-sdk/         # React wrappers for the tracking engine
└── dashboard/          # Analytics visualizations for organizers
```

### Key Logic Hooks

- `useTicketPurchase(eventId)`: Orchestrates the 3-step purchase flow (BD Check -> Approval -> Mint).
- `useBehavioralTelemetry()`: The invisible listener that pipes events to the Detection API.
- `useSoulboundData()`: Fetches on-chain reputation for gating.

---

## 📈 Operational Workflows & Case Studies

### Case Study 1: The "Straight-Line" Bot
**Scenario**: A bot is script-designed to move the mouse perfectly between the "Home" link and the "Purchase" button.
1.  **Tracker**: Captures 15 `mousemove` events over 200ms.
2.  **Detection Svc**: Features are engineered: `jerk=0`, `curvature=0`, `linearity_score=0.99`.
3.  **Inference Svc**: XGBoost identifies this as "Highly Artificial."
4.  **Decision**: 403 Forbidden sent to the purchase attempt.

### Case Study 2: The Residential Proxy Farm
**Scenario**: A scalper uses 1,000 different residential IPs to appear as real home users.
1.  **Connection**: Detection service looks at the JA4 fingerprint.
2.  **Signal**: All 1,000 sessions have identical TLS/JS fingerprints despite different IPs.
3.  **Action**: "Cluster Detection" triggered. All 1,000 sessions are sent a mandatory AI-image challenge. 

---

## 🛠️ Deployment Checklist (Production)

Before launching a Mainnet sale, ensure the following steps are verified.

### 1. Smart Contract Integrity
- [ ] Verify contract on CeloScan using Hardhat-verify.
- [ ] Set `maxResalePercent` and `royaltyWallet` via owner multisig.
- [ ] Fund the Relayer account for gas-less transactions (if enabled).

### 2. Bot Detection Scalability
- [ ] Scale Inference pods to $N$ replicas where $N$ = (Expected peak traffic / 500 req/sec).
- [ ] Warm up Redis cache with known bad/good IP ranges.
- [ ] Execute `k6` load test: 5,000 Concurrent Users with behavioral playback.

### 3. Frontend Optimizations
- [ ] Build production bundle using `pnpm build`.
- [ ] Configure CDN (Vercel/Cloudflare) edge caching for event metadata.
- [ ] Verify global wallet connection stability (Sepolia and Mainnet).

---

## 📖 Glossary of Terms

| Term | Definition |
| :--- | :--- |
| Layer | Technologies |
|---|---|
| **Frontend Framework** | Next.js 14, React 18, TypeScript 5 |
| **Styling** | TailwindCSS 3.4, Radix UI / shadcn/ui, Lucide Icons |
| **State Management** | TanStack React Query, React Context |
| **Web3 Client** | Wagmi 2, Viem 2, RainbowKit 2, Celo ContractKit |
| **Wallet** | MetaMask (via RainbowKit) |
| **Blockchain** | Celo (EVM-compatible, Mainnet + Sepolia Testnet) |
| **Smart Contracts** | Solidity 0.8.17, OpenZeppelin 4.9.6 |
| **Token Standard** | ERC-721 (NFT Tickets), ERC-20 (cUSD Payments) |
| **Identity** | Soulbound NFT (Non-Transferable ERC-721) |
| **Dev Framework** | Hardhat 2.22, Ethers.js 6 |
| **AI/ML** | Custom TypeScript agents, Python (TensorFlow, CNN) |
| **Storage** | Pinata IPFS (images/metadata), Celo (on-chain data) |
| **Deployment** | Vercel (frontend), Celoscan (contract verification) |
| **Package Manager** | pnpm |
| **Linting & Formatting** | ESLint, Prettier |
| **Analytics** | Vercel Analytics |

---

## Resale Functionality

Rexell includes a comprehensive resale system designed to prevent ticket scalping while allowing legitimate ticket transfers:

1. **Resale Verification**: Users must request verification before reselling tickets
2. **Organizer Approval**: Event organizers must approve all resale requests
3. **Price Control**: Resale prices are visible to organizers
4. **Limited Resales**: Each ticket can only be resold once

For detailed information about the resale functionality, see [RESALE.md](frontend/components/RESALE.md).

## Installation and Setup

### Prerequisites
Ensure you have **Node.js** installed.

### Steps
1. Clone the repository:
   ```bash
   git clone https://github.com/Sayyed23/Rexell
   cd Rexell/frontend
   ```
2. Install dependencies:

    ```bash
    pnpm install
    ```

3. Run the application:

    ```bash
    npm run dev
    ```

------

## 🔬 Smart Contract Technical Specification

### 1. `Rexell.sol` Interface

The primary NFT contract governing ticket issuance and secondary market rules.

**Functions:**

*   `createEvent(string memory _name, uint256 _price, uint256 _totalTickets, uint256 _startTime)`
    *   *Access*: Organizer Role
    *   *Emits*: `EventCreated(uint256 eventId, string name, uint256 price)`
*   `buyTicket(uint256 _eventId, string memory _tokenURI)`
    *   *Access*: Public (Gated by Bot Detection Token)
    *   *Payment*: Required in cUSD via `transferFrom`
    *   *Logic*: Checks `maxTicketsPerWallet`, subtracts from `remainingTickets`.
*   `listTicketForResale(uint256 _ticketId, uint256 _price)`
    *   *Requirement*: `_price <= events[eventId].price * maxResaleMultiplier`
*   `buyResaleTicket(uint256 _ticketId)`
    *   *Automation*: Automatically transfers `royaltyAmount` to Organizer and `sellerProceeds` to Seller.

**Events:**

| Event | Parameters | Rationale |
| :--- | :--- | :--- |
| `TicketMinted` | `(uint256 ticketId, address owner, uint256 eventId)` | Indexing for My Profile page. |
| `ResaleListed` | `(uint256 ticketId, uint256 price)` | Marketplace feed updates. |
| `IdentityVerified` | `(address user, uint256 score)` | Reputation tracking for UI. |

---

## 🗄️ Database Schema & Data Models (Postgres)

The bot-detection services utilize a shared PostgreSQL database with the following critical tables.

### `sessions` (Behavioral Core)
Tracks the lifecycle of a high-risk user session.

| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | UUID (PK) | Primary session identifier. |
| `wallet_address` | VARCHAR(42) | User's wallet (salted/hashed). |
| `risk_score` | FLOAT | Current normalized risk (0.0 - 1.0). |
| `is_bot` | BOOLEAN | Final classification flag. |
| `created_at` | TIMESTAMP | Session start time. |

### `raw_events` (Telemetry Storage)
Stores raw behavioral telemetry for forensics and retraining.

| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | BIGINT (PK) | Auto-incrementing ID. |
| `session_id` | UUID (FK) | Reference to sessions table. |
| `event_type` | VARCHAR(20) | `click`, `mousemove`, `keypress`, `scroll`. |
| `data` | JSONB | Raw payload (coordinates, deltas, fingerprints). |

### `challenges` (Verification Tracking)
Manages the state of interactive bot challenges.

| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | UUID (PK) | Challenge ID. |
| `type` | VARCHAR(10) | `pow`, `image`, `behavioral`. |
| `status` | VARCHAR(15) | `pending`, `solved`, `failed`, `expired`. |
| `payload` | JSONB | Verification tokens and solving metadata. |

---

## ⚛️ Frontend Component Architecture

### Component Hierarchy

```text
app/
├── (auth)/             # Wallet connection and profile routes
├── (discovery)/        # Event marketplace and search
├── (ticketing)/        # Purchase flow and challenge UI
│   ├── [eventId]/
│   │   ├── PurchaseButton.tsx
│   │   ├── BotDetectionGuard.tsx
│   │   └── ChallengeOverlay.tsx
components/
├── shared/             # Atomic design (Button, Card, Input)
├── blockchain/         # Web3 specific components (WalletButton)
├── rexell-sdk/         # React wrappers for the tracking engine
└── dashboard/          # Analytics visualizations for organizers
```

### Key Logic Hooks

- `useTicketPurchase(eventId)`: Orchestrates the 3-step purchase flow (BD Check -> Approval -> Mint).
- `useBehavioralTelemetry()`: The invisible listener that pipes events to the Detection API.
- `useSoulboundData()`: Fetches on-chain reputation for gating.

---

## 📈 Operational Workflows & Case Studies

### Case Study 1: The "Straight-Line" Bot
**Scenario**: A bot is script-designed to move the mouse perfectly between the "Home" link and the "Purchase" button.
1.  **Tracker**: Captures 15 `mousemove` events over 200ms.
2.  **Detection Svc**: Features are engineered: `jerk=0`, `curvature=0`, `linearity_score=0.99`.
3.  **Inference Svc**: XGBoost identifies this as "Highly Artificial."
4.  **Decision**: 403 Forbidden sent to the purchase attempt.

### Case Study 2: The Residential Proxy Farm
**Scenario**: A scalper uses 1,000 different residential IPs to appear as real home users.
1.  **Connection**: Detection service looks at the JA4 fingerprint.
2.  **Signal**: All 1,000 sessions have identical TLS/JS fingerprints despite different IPs.
3.  **Action**: "Cluster Detection" triggered. All 1,000 sessions are sent a mandatory AI-image challenge. 

---

## 🛠️ Deployment Checklist (Production)

Before launching a Mainnet sale, ensure the following steps are verified.

### 1. Smart Contract Integrity
- [ ] Verify contract on CeloScan using Hardhat-verify.
- [ ] Set `maxResalePercent` and `royaltyWallet` via owner multisig.
- [ ] Fund the Relayer account for gas-less transactions (if enabled).

### 2. Bot Detection Scalability
- [ ] Scale Inference pods to $N$ replicas where $N$ = (Expected peak traffic / 500 req/sec).
- [ ] Warm up Redis cache with known bad/good IP ranges.
- [ ] Execute `k6` load test: 5,000 Concurrent Users with behavioral playback.

### 3. Frontend Optimizations
- [ ] Build production bundle using `pnpm build`.
- [ ] Configure CDN (Vercel/Cloudflare) edge caching for event metadata.
- [ ] Verify global wallet connection stability (Sepolia and Mainnet).

---

## 📖 Glossary of Terms

| Term | Definition |
| :--- | :--- |
| **JA4** | A standardized fingerprinting method for TLS connections. |
| **Soulbound** | A crypto token that is permanently bound to one wallet and non-transferable. |
| **Inference** | The process of a trained ML model making a prediction on new data. |
| **cUSD** | A stablecoin pegged to the US Dollar on the Celo network. |
| **Headless** | A browser running without a graphical user interface, often used by bots. |
| **PoW Challenge** | A Proof-of-Work task that slows down bots by forcing them to compute hashes. |

---

## 🤝 Contribution & Governance

We welcome contributions from the community!

### How to Contribute
1.  **Fork the Project**: Create a feature branch (`git checkout -b feature/AmazingFeature`).
2.  **Commit Changes**: Follow conventional commits (`feat: add new challenge type`).
3.  **Push and PR**: Open a Pull Request for review.

### Coding Standards
*   **Python**: Black formatter, Type hints required, pytest for all additions.
*   **Solidity**: Slither for security analysis, Hardhat-gas-reporter enabled.
*   **Frontend**: ESLint with custom React rules, Accessibility (A11y) checks.

---

## 📜 License & Acknowledgments

*   **License**: Distributed under the MIT License. See `LICENSE` for more information.
*   **Celo Foundation**: For providing the scalable infrastructure for accessible finance.
*   **OpenZeppelin**: For robust, secure smart contract templates.
*   **FastAPI**: For making high-performance asynchronous backends a joy to write.

---

## 🆘 Support & Contact

*   **Discord**: [Join our developer community](https://discord.gg/rexell)
*   **Twitter/X**: [@Rexell_Dev](https://twitter.com/Rexell_Dev)
*   **Email**: engineering@rexell.io

---

## 📡 API Reference & Payload Examples

### `POST /v1/detect`
The primary endpoint for real-time risk assessment.

**Sample Request:**
```json
{
  "session_id": "550e8400-e29b-41d4-a716-446655440000",
  "wallet_address": "0x1234...5678",
  "action": "buy_ticket",
  "telemetry": {
    "fingerprint": "ja4:t13d1516h2...",
    "events": [
      {"type": "mousemove", "ts": 1713865200000, "x": 100, "y": 200},
      {"type": "click", "ts": 1713865200500, "btn": 0}
    ],
    "env": {
      "ua": "Mozilla/5.0...",
      "webdriver": false,
      "res": "1920x1080"
    }
  }
}
```

**Sample Response (Decision: Block):**
```json
{
  "decision": "block",
  "reason": "mismatch_ua_tls",
  "risk_score": 0.98,
  "request_id": "req_8892"
}
```

**Sample Response (Decision: Challenge):**
```json
{
  "decision": "challenge",
  "challenge_id": "chal_771",
  "type": "image_selection",
  "instructions": "Select all squares with bicycles."
}
```

---

## 🔐 Environment Variables Configuration

The system uses specific variables to connect to various services and secure communication.

| Variable | Service | Purpose | Secret? |
| :--- | :--- | :--- | :--- |
| `DATABASE_URL` | Detection | Postgres connection string (SQLAlchemy format). | Yes |
| `REDIS_URL` | Shared | Cache and rate-limiting store. | Yes |
| `RABBITMQ_URL` | Shared | Messaging for logs and training triggers. | Yes |
| `INFERENCE_API_URL`| Detection | The internal URL of the inference service. | No |
| `CELO_RPC_URL` | Frontend | Connectivity to the Celo network. | No |
| `MINIO_ENDPOINT` | Inference | Where the XGBoost models are stored. | No |
| `DETECTION_API_KEYS`| Detection | Comma-separated list of valid client keys. | Yes |
| `JWT_SECRET` | Challenge | For signing verification tokens. | Yes |

---

## 🟢 Why Celo for Rexell?

We chose the **Celo Network** for several strategic technical reasons:

1.  **Mobile-First Design**: Celo's lightweight identity protocol allows us to tie tickets to phone numbers, adding an extra layer of bot protection.
2.  **Stablecoin Integration**: Native support for **cUSD** means buyers don't have to deal with the volatility of CELO or ETH, making it accessible to non-crypto natives.
3.  **Low Gas Fees**: High-volume ticket minting becomes economically viable when transaction costs are fractions of a cent.
4.  **Carbon Neutrality**: As a "Green Blockchain," Celo aligns with the sustainability values of modern event organizers.
5.  **Fast Finality**: Tickets are minted and ownership transferred in ~5 seconds, preventing "Double-Spend" or "Front-Running" during peak sales.

---

## 🛡️ Security Bounty Program

We believe in the power of the community to help us secure the ticketing ecosystem.

### Scope
-   Bypassing the Bot Detection Engine (without using high-cost human farms).
-   Exploiting Smart Contract logic (Re-entrancy, logic errors).
-   Unauthorized access to the ML training pipeline.

### Reporting
Please send all findings to **security@rexell.io**. High-severity findings are rewarded with **cUSD** and a spot on our Developer Wall of Fame.

---
<p align="center">
  <b>Rexell: Protecting the Ticket, Protecting the Fan.</b><br>
  Built with cutting-edge tech for a fairer world.
</p>

<p align="right">(<a href="#top">back to top</a>)</p>

<!-- END OF AUTHORITATIVE README -->
