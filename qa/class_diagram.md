# 🏛️ Rexell - Class Diagram

This UML class diagram defines the software classes, properties, and methods of the Next.js React client modules, Python microservices, and Solidity EVM contracts.

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

    %% Browser SDK & In-Browser AI classes
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

    %% Backend FastAPI Services
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

    %% Inheritance Relations
    ERC721URIStorage --|> ERC721
    Rexell --|> ERC721URIStorage
    Rexell --|> Ownable
    Rexell --|> ReentrancyGuard
    SoulboundIdentity --|> ERC721
    SoulboundIdentity --|> Ownable

    %% Associations and Dependencies
    AIModeService *-- BotDetector
    AIModeService *-- ScalpingDetector
    AIModeService *-- RiskEvaluationAgent
    AIModeService *-- PolicyEnforcementAgent
    
    BotDetectionClient ..> DetectionService : "sends HTTP telemetry"
    DetectionService ..> InferenceService : "requests XGBoost risk score"
    DetectionService ..> ChallengeService : "delegates MFA challenges"
    DetectionService ..> FallbackController : "uses for active defense"
    
    %% Contract connections
    Rexell --> SoulboundIdentity : "verifies user score is 70 plus"
    BotDetectionClient ..> Rexell : "provides signed verification token"
```
