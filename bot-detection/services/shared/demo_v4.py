import sys
import os
import asyncio
import time
from unittest.mock import AsyncMock, MagicMock

# Add src to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "src")))

from shared.models.types import (
    BehavioralData, 
    MouseEvent, 
    KeystrokeEvent, 
    NavigationEvent, 
    EventType,
    RiskContext
)
from shared.analyzer import BehavioralAnalyzer
from shared.clients.ml_client import MLInferenceClient
from shared.risk_scorer import RiskScorer, ReputationService

async def run_demo():
    print("--- Rexell Task 4 Risk Scorer Demo ---")
    
    # 1. Create a user session with behavioral data
    events = []
    start_ts = time.time()
    
    # Mock some mouse movements
    for i in range(5):
        events.append(MouseEvent(
            timestamp=start_ts + i * 0.1,
            type=EventType.mousemove,
            x=100, y=100 + i * 20
        ))
    
    data = BehavioralData(
        sessionId="sess_999",
        walletAddress="0x742d35Cc6634C0532925a3b844Bc454e4438f44e",
        userAgent="Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
        ipAddress="192.168.1.1",
        events=events
    )
    
    # 2. Behavioral Analysis
    analyzer = BehavioralAnalyzer()
    features = analyzer.extract_features(data)
    print(f"Features extracted (Velocity Mean: {features.mouse_velocity_mean:.4f})")

    # 3. Setup Mock Clients & Services
    # Mock ML Client probability (0.75 - suspicious)
    ml_client = MLInferenceClient("http://localhost:8080")
    ml_client.get_prediction_with_fallback = AsyncMock(return_value=0.75)
    
    # Mock Reputation Service
    reputation_service = MagicMock(spec=ReputationService)
    reputation_service.get_reputation_score = AsyncMock(return_value=90.0) # High reputation

    risk_scorer = RiskScorer(ml_client, reputation_service)

    # 4. Scenario A: Normal Purchase
    print("\nScenario A: Single Ticket Purchase (High Reputation)")
    risk_score_a = await risk_scorer.calculate_risk_score(
        "user_hash_123", 
        features, 
        context=RiskContext(isBulkPurchase=False)
    )
    print(f"  Final Score: {risk_score_a.score:.2f}")
    print(f"  Decision: {risk_score_a.decision.value}")
    for factor in risk_score_a.factors:
        print(f"    - {factor.factor}: {factor.contribution:+.2f} ({factor.description})")

    # 5. Scenario B: Bulk Purchase (Same Features)
    print("\nScenario B: Bulk Ticket Purchase (1.5x Multiplier)")
    risk_score_b = await risk_scorer.calculate_risk_score(
        "user_hash_123", 
        features, 
        context=RiskContext(isBulkPurchase=True, requestedQuantity=10)
    )
    print(f"  Final Score: {risk_score_b.score:.2f}")
    print(f"  Decision: {risk_score_b.decision.value}")

    # 6. Scenario C: ML Service Failure (Fallback)
    print("\nScenario C: ML Service Failure (Circuit Open/Error)")
    ml_client.get_prediction_with_fallback = AsyncMock(return_value=0.6) # Fallback score per requirement
    risk_score_c = await risk_scorer.calculate_risk_score(
        "user_hash_123", 
        features, 
        context=RiskContext(isBulkPurchase=False)
    )
    print(f"  Final Score: {risk_score_c.score:.2f}")
    print(f"  Decision: {risk_score_c.decision.value}")

if __name__ == "__main__":
    asyncio.run(run_demo())
