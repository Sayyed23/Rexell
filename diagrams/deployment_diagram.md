# 🚀 Rexell - Deployment Diagram

This diagram visualizes the system's runtime components, highlighting client environments, edge servers, storage layers, and containerized microservices alongside the Celo EVM blockchain network.

![Deployment Diagram](images/deployment_diagram.png)

```mermaid
flowchart TB
    subgraph ClientSpace["🖥️ Client Environment (User's Web Browser)"]
        subgraph Browser["Web Browser"]
            FE_Code["React Client-Side SPA <br/> (Next.js 14 App Router)"]
            SDK["Behavioral SDK Tracker <br/> (Circular telemetry buffer)"]
            Wallet["Web3 Wallet <br/> (MetaMask / RainbowKit)"]
            Local_Store[(Browser LocalStorage <br/> Client AI logs and history)]
        end
    end

    subgraph CDN["☁️ Edge Delivery Network (Vercel)"]
        Next_Server["Next.js Node.js Server <br/> (SSR / ISR and API Gateway routes)"]
    end

    subgraph IPFS["💾 Decentralized File System"]
        Pinata["Pinata Cloud Gateway / IPFS <br/> (Event assets and NFT JSON metadata)"]
    end

    subgraph BlockchainNetwork["⛓️ Celo EVM Network (Sepolia / Mainnet)"]
        RPC_Node["Celo RPC Node / Gateway <br/> (drpc.org / forno)"]
        
        subgraph Contracts["Smart Contracts"]
            Rexell_Contract["Rexell.sol <br/> (ERC-721 Tickets and Marketplace)"]
            SIdentity_Contract["SoulboundIdentity.sol <br/> (Non-transferable KYC and trust scores)"]
            cUSD_Contract["cUSD Stablecoin <br/> (ERC-20 payment ledger)"]
        end
    end

    subgraph ServerSpace["🐳 Server Infrastructure (Kubernetes Cluster)"]
        Ingress["Kubernetes Ingress Controller <br/> (TLS termination and routing)"]

        subgraph AISM["AI & Bot Detection Services (FastAPI Pods)"]
            Det_Service["Detection Service Pod <br/> (Port 8000 /v1/detect)"]
            Inf_Service["Inference Service Pod <br/> (Port 8080 XGBoost engine)"]
            Chal_Service["Challenge Service Pod <br/> (Port 8001 /v1/challenge)"]
            Train_Job["Monthly Retraining Job <br/> (K8s CronJob Pod)"]
        end

        subgraph StatefulDeps["Stateful Service Dependencies"]
            Postgres[(PostgreSQL Pod <br/> Risk records and audit logs)]
            Redis[(Redis Pod <br/> Rate limiter and resale window cache)]
            RabbitMQ[(RabbitMQ Pod <br/> Alerts and retraining events)]
            MinIO[(MinIO / S3 Pod <br/> XGBoost model files and parquets)]
        end
    end

    subgraph Monitoring["📊 Observability Platform"]
        Prometheus["Prometheus Server <br/> (Scrapes FastAPI /metrics)"]
        Grafana["Grafana Dashboards <br/> (Operational and detection dashboards)"]
    end

    %% Client Interactions
    FE_Code -->|telemetry & tokens| Ingress
    SDK -->|events data| FE_Code
    Wallet -->|sign & broadcast tx| RPC_Node
    FE_Code <-->|read/write| Local_Store

    %% CDN & Asset Loading
    FE_Code <-->|SSR pages & API| Next_Server
    Next_Server -->|pin metadata/images| Pinata
    FE_Code -->|fetch metadata| Pinata

    %% Ingress & API Services
    Ingress -->|/v1/detect & /v1/token| Det_Service
    Ingress -->|/v1/challenge| Chal_Service

    %% Service Connections
    Det_Service <-->|predict risk| Inf_Service
    Det_Service <-->|verify challenge| Chal_Service
    Det_Service <-->|read/write state| Postgres
    Det_Service <-->|check rates & windows| Redis
    Det_Service -->|publish security alerts| RabbitMQ
    
    Inf_Service -->|fetch model.joblib| MinIO
    Train_Job -->|read telemetry tables| Postgres
    Train_Job -->|save trained models| MinIO
    
    RPC_Node <-->|read contract state| FE_Code
    RPC_Node <-->|cUSD & identity validation| Contracts

    %% Monitoring Connections
    Prometheus -->|scrape metrics| Det_Service
    Prometheus -->|scrape metrics| Inf_Service
    Prometheus -->|scrape metrics| Chal_Service
    Grafana -->|query metric metrics| Prometheus

    %% Style classes
    classDef client fill:#e0f2fe,stroke:#0284c7,stroke-width:2px,color:#0369a1;
    classDef server fill:#f3e8ff,stroke:#7c3aed,stroke-width:2px,color:#6d28d9;
    classDef stateful fill:#fef3c7,stroke:#d97706,stroke-width:2px,color:#b45309;
    classDef blockchain fill:#dcfce7,stroke:#15803d,stroke-width:2px,color:#166534;
    classDef monitor fill:#fee2e2,stroke:#dc2626,stroke-width:2px,color:#991b1b;

    class FE_Code,SDK,Wallet,Local_Store client;
    class Next_Server,Ingress,Det_Service,Inf_Service,Chal_Service,Train_Job server;
    class Postgres,Redis,RabbitMQ,MinIO stateful;
    class RPC_Node,Rexell_Contract,SIdentity_Contract,cUSD_Contract blockchain;
    class Prometheus,Grafana monitor;

    linkStyle default stroke:#64748b,stroke-width:1px;
    linkStyle 0,1,10,11 stroke:#0284c7,stroke-dasharray: 5 5,stroke-width:2px;
    linkStyle 2,16 stroke:#15803d,stroke-width:2px;
```
