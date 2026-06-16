# 🌐 Rexell - High-Level Architecture

This diagram provides a high-level overview of the user browser, the frontend web application layer, the decentralized Celo smart contracts, client-side browser storage, and server-side bot-detection microservices.

![High Level Architecture](images/high_level_architecture.png)

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
