# 💠 REXELL - SYSTEM ARCHITECTURE DIAGRAMS 💠

This document provides a comprehensive view of Rexell's architecture, including its deployment topology, data relationships (on-chain and off-chain), and class-level component definitions. The system combines Next.js frontend clients, a Kubernetes-deployed serverless/containerized AI bot-detection backend, and smart contracts on the Celo EVM blockchain network.

---

## 🚀 1. Deployment Diagram

The deployment diagram illustrates the physical topology of the Rexell platform, detailing the runtime environments for the frontend web application, the EVM-compatible blockchain network, and the server-side AI/ML bot-detection microservices running on a Kubernetes cluster.

![Deployment Diagram](diagrams/images/deployment_diagram.png)

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

> [!NOTE]
> The **Behavioral SDK** records user telemetry (mouse cursor coordinates, clicks, keystrokes, and focus events) at a sample rate of $\ge 20\text{ Hz}$. This telemetry is stored temporarily in a client-side circular buffer (4096 entries max) and transmitted to the `Detection Service` when the user triggers a "Buy Ticket" or "Resale Request" event.

---

## 🗃️ 2. Entity-Relationship (ER) Diagram

This diagram displays the hybrid data storage configuration. It illustrates how the relational SQL database schemas (representing the server-side bot-detection telemetry and states) map conceptually to the decentralized storage schemas on the Celo blockchain.

![ER Diagram](diagrams/images/er_diagram.png)

```mermaid
erDiagram
    %% PostgreSQL Database Entities
    BEHAVIORAL_DATA {
        string id PK
        string session_id FK
        string user_hash FK "SHA256 hashed wallet address"
        string user_agent
        string ip_address "Truncated subnet IP"
        json events "Mouse/keyboard movements circular buffer"
        bigint created_at
        bigint expires_at "created_at + 90 days"
    }

    RISK_SCORE {
        string id PK
        string behavioral_data_id FK "References behavioral_data.id"
        string user_hash FK
        string session_id
        float score "XGBoost calculated risk index from 0 to 100"
        string decision "ALLOW / CHALLENGE / BLOCK"
        json factors "Feature importance indicators"
        bigint created_at
    }

    VERIFICATION_TOKEN {
        string token_id PK "HMAC-SHA256 signature token"
        string user_hash FK
        string event_id
        int max_quantity
        bigint issued_at
        bigint expires_at "issued_at + 5 minutes"
        bigint consumed_at "Null if not used"
        string tx_hash "On-chain transaction hash link"
    }

    USER_REPUTATION {
        string user_hash PK "SHA256 wallet address (unique)"
        float reputation_score "Overall trust rating (0.0-100.0)"
        boolean trusted_status "If true, bypasses resale speed limits"
        boolean flagged "If true, triggers manual review"
        bigint created_at
        bigint updated_at
    }

    CHALLENGE_STATE {
        string challenge_id PK
        string user_hash FK
        string session_id
        string challenge_type "IMAGE_SELECT / GESTURE / MULTISTEP"
        string status "PENDING / SUCCESS / FAILED / EXPIRED"
        int attempts
        bigint created_at
        bigint expires_at
    }

    AUDIT_LOG {
        string id PK
        bigint timestamp
        string accessor_identity "API key hash or service identifier"
        string operation_type "READ / DELETE / CRON"
        string resource_type "e.g., behavioral_data"
        string resource_id
        json details "Scrubbed parameters"
    }

    %% Blockchain (Smart Contract) Mappings - Conceptual Schema
    CELO_ACCOUNT {
        address wallet_address PK "User's public blockchain key"
        uint256 cUSD_balance "Stablecoin payment tokens"
    }

    NFT_TICKET {
        uint256 tokenId PK
        uint256 eventId FK
        address current_owner
        string tokenURI "IPFS hash details link"
        boolean isCancelled
    }

    BLOCKCHAIN_EVENT {
        uint256 eventId PK
        address organizer FK
        string name
        string venue
        string category
        uint256 date "Epoch timestamp"
        string time
        uint256 price "cUSD unit cost"
        uint256 ticketsAvailable
        string ipfs "IPFS metadata hash"
        uint256 totalRating
        uint256 ratingCount
    }

    RESALE_REQUEST {
        uint256 tokenId PK, FK
        address owner FK
        uint256 price
        boolean approved
        boolean rejected
    }

    EVENT_COMMENT {
        uint256 commentId PK
        uint256 eventId FK
        address commenter FK
        string text
        uint256 timestamp
    }

    SOULBOUND_IDENTITY_NFT {
        uint256 identityId PK
        address owner FK "One-to-one non-transferable address link"
        uint256 verificationScore "EVM score index from 0 to 100"
        uint256 kycTimestamp
    }

    %% Relationships - SQL Database Schema
    BEHAVIORAL_DATA ||--o| RISK_SCORE : "produces"
    BEHAVIORAL_DATA ||--o{ CHALLENGE_STATE : "triggers"
    RISK_SCORE ||--o| VERIFICATION_TOKEN : "authorizes"
    USER_REPUTATION ||--o{ RISK_SCORE : "tracks history"
    USER_REPUTATION ||--o{ VERIFICATION_TOKEN : "governs rates"
    USER_REPUTATION ||--o{ CHALLENGE_STATE : "monitors compliance"

    %% Hybrid Links (Postgres to Celo Mapping)
    CELO_ACCOUNT ||--o| USER_REPUTATION : "represented by user_hash"
    CELO_ACCOUNT ||--o| SOULBOUND_IDENTITY_NFT : "binds"
    CELO_ACCOUNT ||--o{ NFT_TICKET : "owns"
    CELO_ACCOUNT ||--o{ BLOCKCHAIN_EVENT : "organizes"
    CELO_ACCOUNT ||--o{ EVENT_COMMENT : "posts"
    CELO_ACCOUNT ||--o{ RESALE_REQUEST : "submits"

    BLOCKCHAIN_EVENT ||--o{ NFT_TICKET : "contains"
    BLOCKCHAIN_EVENT ||--o{ EVENT_COMMENT : "houses"
    NFT_TICKET ||--o| RESALE_REQUEST : "resold_via"
    VERIFICATION_TOKEN ||--o| NFT_TICKET : "authorizes_minting_of"
```

> [!IMPORTANT]
> The database tracks the user using the `user_hash` (the SHA-256 hash of the public wallet address) to enforce **GDPR/CCPA compliance** and prevent PII (Personally Identifiable Information) leakage. IP addresses are truncated to `/24` subnets (IPv4) or `/48` subnets (IPv6), and User-Agents are normalized before processing.

---

## 🏛️ 3. Class Diagrams

The class diagrams map the programmatic components of the system, divided into client-side browser modules, backend Python microservices, and Solidity smart contracts.

### ⛓️ 3.1 Smart Contracts Class Diagram

This diagram maps the inheritance, fields, and functions of the core smart contracts deployed on Celo.

![Class Diagram 1](diagrams/images/class_diagram_1.png)

```mermaid
classDiagram
    %% OpenZeppelin and Base contracts
    class ERC721 {
        +transferFrom(address from, address to, uint256 tokenId) void
        +ownerOf(uint256 tokenId) address
        +balanceOf(address owner) uint256
    }
    class ERC721URIStorage {
        +tokenURI(uint256 tokenId) string
        #_setTokenURI(uint256 tokenId, string uri) void
    }
    class Ownable {
        +owner() address
        +transferOwnership(address newOwner) void
        +onlyOwner() modifier
    }
    class ReentrancyGuard {
        #nonReentrant() modifier
    }

    %% Smart Contracts (Solidity)
    class Rexell {
        +IERC20 cUSDToken
        +SoulboundIdentity identityContract
        +uint256 royaltyPercent
        +uint256 nextEventId
        +uint256 nextTicketId
        +mapping verifiedResellers
        +mapping resaleRequests
        +createEvent(string name, string venue, uint price, uint ticketsAvailable, string ipfs) void
        +buyTicket(uint eventId, string nftUri) void
        +buyTickets(uint eventId, string[] nftUris, uint quantity) void
        +requestResaleVerification(uint256 tokenId, uint256 price) void
        +approveResale(uint256 tokenId) void
        +buyResaleTicket(uint256 tokenId, uint256 maxPrice) void
        +cancelTicket(uint256 tokenId) void
    }

    class SoulboundIdentity {
        +mapping userToIdentity
        +mapping verificationScores
        +mapping kycTimestamps
        +mintIdentity(address user, uint256 score) void
        +updateScore(address user, uint256 newScore) void
        +burnIdentity(address user) void
        +hasValidIdentity(address user) bool
        +getIdentityDetails(address user) tuple
        -beforeTokenTransfer(address from, address to, uint256 tokenId) void
    }

    %% Inheritance Relations
    ERC721URIStorage --|> ERC721
    Rexell --|> ERC721URIStorage
    Rexell --|> Ownable
    Rexell --|> ReentrancyGuard
    SoulboundIdentity --|> ERC721
    SoulboundIdentity --|> Ownable
    Rexell --> SoulboundIdentity : "verifies KYC status"
```

### 🖥️ 3.2 Client-Side & Browser SDK Class Diagram

This diagram captures classes operating within the attendee's browser environment, including the telemetry tracker and local risk evaluation agents.

![Class Diagram 2](diagrams/images/class_diagram_2.png)

```mermaid
classDiagram
    class BehavioralTracker {
        -circularBuffer events
        -number sampleIntervalMs
        -boolean isTracking
        +start() void
        +stop() void
        +getEvents() list
        -handleMouseMove(event) void
        -handleInputMasking(input) void
    }

    class BotDetectionClient {
        -string apiUrl
        -string apiKey
        +detect(string wallet, object behavioralData) Promise
        +verifyChallenge(string challengeId, object proof) Promise
        +consumeToken(string token) Promise
        +checkResale(string wallet, uint256 tokenId) Promise
    }

    class AIModeService {
        -list history
        -BotDetector botDetector
        -ScalpingDetector scalpingDetector
        -RiskEvaluationAgent riskAgent
        -PolicyEnforcementAgent policyAgent
        +assessRisk(string wallet, number eventId) RiskAssessment
        +recordPurchase(string wallet, number eventId) void
        -loadHistory() void
    }

    class RiskEvaluationAgent {
        +evaluate(number botScore, number scalpingScore) RiskEvaluation
    }

    class PolicyEnforcementAgent {
        +decide(RiskEvaluation evaluation) DecisionResponse
    }

    %% Associations and Dependencies
    AIModeService *-- RiskEvaluationAgent
    AIModeService *-- PolicyEnforcementAgent
    BotDetectionClient ..> AIModeService : "queries risk rules"
```

### 🐳 3.3 Backend API Services Class Diagram

This diagram displays the server-side microservice controllers responsible for real-time model inference, challenge verification, and active rate-limiting defense.

![Class Diagram 3](diagrams/images/class_diagram_3.png)

```mermaid
classDiagram
    class DetectionService {
        -string secretSigningKey
        +detect(request) DetectionResponse
        +consumeToken(token) TokenResponse
        +resaleCheck(wallet, tokenId) ResaleResponse
    }

    class InferenceService {
        -XGBoostModel currentModel
        -ABRouter abRouter
        +predict(features) float
        +deployNewModel(modelPath) void
    }

    class ChallengeService {
        -ChallengeEngine engine
        +createChallenge(session) ChallengePayload
        +verifySolution(challengeId, response) boolean
    }

    class FallbackController {
        -boolean dependenciesHealthy
        -int hardTicketLimit
        +checkHealth() void
        +applyFallbackLimits(wallet) boolean
    }

    %% Associations and Dependencies
    DetectionService ..> InferenceService : "requests XGBoost risk score"
    DetectionService ..> ChallengeService : "delegates MFA challenges"
    DetectionService ..> FallbackController : "uses for active defense"
```

---

## 🔄 4. End-to-End Multi-Module Decision Flow

To clarify how the modules communicate across the **Client**, **Server-Side AI**, and **Blockchain** boundaries, the sequence chart below shows a typical transaction workflow:

![Sequence Diagram](diagrams/images/sequence_diagram.png)

```mermaid
sequenceDiagram
    autonumber
    actor User as "Attendee (Browser)"
    participant SDK as Behavioral SDK
    participant FE as Next.js App
    participant DET as "Detection Service (:8000)"
    participant INF as "Inference Server (:8080)"
    participant CHA as "Challenge Engine (:8001)"
    participant CELO as "Celo Blockchain (Rexell.sol)"

    User->>FE: Select event and click "Buy Ticket"
    SDK->>DET: POST /v1/detect (behavioral_data, wallet_hash)
    Note over DET: Feature extraction:<br/>Calculate mouse velocity, click cadence and UA entropy
    DET->>INF: POST /predictions (features)
    INF-->>DET: Return risk_score (e.g., 65/100)
    
    rect rgb(240, 248, 255)
        Note over DET: Challenge Threshold Triggered (Score between 50 and 80)
        DET->>CHA: Create verification challenge (IMAGE_SELECT)
        CHA-->>DET: Challenge metadata (challenge_id, visual grid payload)
        DET-->>SDK: Return decision: "challenge" + challenge details
        FE->>User: Display verification challenge overlay
        User->>FE: Complete challenge selection
        FE->>CHA: POST /v1/verify (challenge_id, selection_coordinates)
        CHA-->>FE: Return success status
    end

    FE->>DET: Re-request token validation (with challenge session proof)
    Note over DET: Verify challenge success and sign token<br/>Token = HMAC(wallet + expiry, SIGNING_KEY)
    DET-->>FE: Return verification token (5 min TTL)
    
    FE->>CELO: broadcast buyTicket(eventId, nftUri, verification_token)
    Note over CELO: Smart Contract verifies:<br/>1. Token expiry and hash integrity<br/>2. SoulboundIdentity KYC score is 70 plus
    CELO-->>FE: Transaction receipt (Mint NFT ticket #102)
    
    FE->>DET: POST /v1/token/consume (verification_token)
    Note over DET: Token marked consumed in database<br/>(Replay attack prevention)
    DET-->>FE: Acknowledged
    FE-->>User: Show Ticket QR Code + NFT Details
```
