# 🗃️ Rexell - ER Diagram

This diagram maps the schema layouts for both the PostgreSQL database tables (used by server-side bot-detection microservices) and the decentralized Celo blockchain smart contract states.

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
