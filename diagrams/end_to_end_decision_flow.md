# 🔁 Rexell - End-to-End AI Decision Flow

This sequence diagram traces a single ticket purchase attempt through both client-side and server-side bot-detection systems, ending with contract validation on the Celo network.

```mermaid
sequenceDiagram
    autonumber
    participant U as User
    participant FE as Next.js Frontend
    participant SDK as Behavioral SDK
    participant DET as "Detection :8000"
    participant INF as "Inference :8080"
    participant CHA as "Challenge :8001"
    participant AI as "lib/ai (in-browser agents)"
    participant SC as "Rexell.sol (Celo)"

    U->>FE: Visit /buy?event=42
    FE->>SDK: useBotDetection().startTracking()
    SDK-->>FE: collecting mouse/keystroke @ 20 Hz plus
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
    FE->>DET: POST /v1/token/consume (token)
    DET-->>FE: ok
    FE-->>U: NFT minted ✅
```
