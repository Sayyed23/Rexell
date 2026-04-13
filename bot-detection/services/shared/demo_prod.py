import sys
import os
import asyncio
import time
from unittest.mock import AsyncMock, MagicMock
import httpx
import redis.asyncio as redis

# Add src to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "src")))

from shared.models.types import (
    BehavioralData, 
    MouseEvent, 
    EventType,
    RiskContext,
    FeatureVector,
    DetectionResponseDecision
)
from shared.clients.ml_client import MLInferenceClient
from shared.risk_scorer import RiskScorer, ReputationService
from shared.config import settings

async def run_demo():
    print("--- Rexell PRODUCTION-GRADE Risk Scorer Demo ---")
    
    # 1. Setup Persistent Clients (Pooled)
    async with httpx.AsyncClient() as http_client:
        redis_mock = AsyncMock(spec=redis.Redis)
        redis_mock.get = AsyncMock(return_value=None) # Cache miss
        redis_mock.setex = AsyncMock() # Add missing mock for setex
        
        # 2. Mock Repositories
        risk_repo = MagicMock()
        # Mock history for fallback: Score 25.0
        risk_repo.get_latest_by_user_hash = AsyncMock(return_value=[MagicMock(score=25.0)])
        
        reputation_repo = MagicMock()
        # Mock 30-day history for reputation calculation
        reputation_repo.session.execute = AsyncMock(return_value=MagicMock(scalars=MagicMock(return_value=MagicMock(all=MagicMock(return_value=[10, 20, 15])))))
        
        reputation_repo.update_score = AsyncMock()
        
        # 3. Setup Services
        ml_client = MLInferenceClient(http_client, repository=risk_repo)
        reputation_service = ReputationService(reputation_repo, redis_mock)
        risk_scorer = RiskScorer(ml_client, reputation_service)

        # 4. Features
        dummy_features = FeatureVector(
            mouse_velocity_mean=0.1, mouse_velocity_std=0.05, 
            mouse_acceleration=0.5, mouse_curvature=1.2,
            click_frequency=2.0, flight_time_mean=150, 
            flight_time_std=50, dwell_time_mean=200,
            navigation_entropy=1.5, page_dwell_time_dist=50
        )

        user_hash = "f8a9c3-hashed"

        # --- Scenario A: ML Service Online ---
        print("\nScenario A: ML Service Online (High Probability)")
        # Mock successful high-risk prediction
        ml_client.get_prediction = AsyncMock(return_value=0.85)
        
        score_a = await risk_scorer.calculate_risk_score(user_hash, dummy_features)
        print(f"  Result: {score_a.decision.value} (Score: {score_a.score:.1f})")

        # --- Scenario B: ML Service Offline (Historical Fallback) ---
        print("\nScenario B: ML Service Offline (2nd Question - Fallback to last known behavior score)")
        # Mock ML error
        ml_client.get_prediction = AsyncMock(side_effect=httpx.ConnectError("Connection refused"))
        
        score_b = await risk_scorer.calculate_risk_score(user_hash, dummy_features)
        print(f"  Result: {score_b.decision.value} (Score: {score_b.score:.1f})")
        print(f"  Note: Fallback risk base was {score_b.factors[0].contribution:.1f} (from DB history)")

        # --- Scenario C: Bulk Purchase Multiplier ---
        print("\nScenario C: Bulk Purchase Multiplier (1.5x)")
        ml_client.get_prediction = AsyncMock(return_value=0.60) # Moderate risk
        
        score_c = await risk_scorer.calculate_risk_score(
            user_hash, 
            dummy_features, 
            context=RiskContext(isBulkPurchase=True, requestedQuantity=10)
        )
        print(f"  Result: {score_c.decision.value} (Score: {score_c.score:.1f})")

if __name__ == "__main__":
    asyncio.run(run_demo())
