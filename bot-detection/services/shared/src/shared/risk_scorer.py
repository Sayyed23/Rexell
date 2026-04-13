import redis.asyncio as redis
import json
import logging
from typing import Optional, List, Dict, Any
from sqlalchemy.future import select
from sqlalchemy import func

from .models.types import (
    RiskScore, 
    RiskFactor, 
    DetectionResponseDecision,
    RiskContext,
    FeatureVector
)
from .db.models import RiskScoreModel, UserReputationModel
from .db.repositories import UserReputationRepository
from .clients.ml_client import MLInferenceClient
from .config import settings
from .utils.time_utils import current_timestamp

logger = logging.getLogger(__name__)

class ReputationService:
    def __init__(self, 
                 repo: UserReputationRepository, 
                 redis_client: redis.Redis):
        self.repo = repo
        self.redis = redis_client

    async def calculate_reputation_from_history(self, user_hash: str) -> float:
        """
        Actually calculate reputation score from transaction history in Postgres.
        Requirement: 30 days of consistency.
        """
        thirty_days_ago = current_timestamp() - (settings.REPUTATION_CONSISTENCY_WINDOW_DAYS * 86400)
        
        # Query risk scores from the last 30 days for this user
        stmt = select(RiskScoreModel.score).where(
            RiskScoreModel.user_hash == user_hash,
            RiskScoreModel.created_at >= thirty_days_ago
        )
        
        result = await self.repo.session.execute(stmt)
        scores = [float(s) for s in result.scalars().all()]
        
        if not scores:
            return 100.0 # New user starts with neutral-to-good reputation
            
        mean_score = sum(scores) / len(scores)
        
        # Updated logic for trusted status (P0 requirement)
        trusted = (
            len(scores) >= settings.REPUTATION_MIN_SESSIONS_FOR_TRUST and 
            mean_score < settings.REPUTATION_MAX_AVG_SCORE_FOR_TRUST
        )
        
        # Persistence
        await self.repo.update_score(
            user_hash, 
            new_score=100.0 - mean_score, # 100 is best, 0 is bot-like
            trusted_status=trusted
        )
        
        return 100.0 - mean_score

    async def get_reputation_score(self, user_hash: str) -> float:
        cache_key = f"reputation:{user_hash}"
        cached_score = await self.redis.get(cache_key)
        
        if cached_score:
            return float(cached_score)
            
        # If cache miss, calculate and refresh
        score = await self.calculate_reputation_from_history(user_hash)
        
        await self.redis.setex(
            cache_key, 
            settings.REPUTATION_CACHE_TTL_SECONDS, 
            str(score)
        )
        return score

class RiskScorer:
    def __init__(self, ml_client: MLInferenceClient, reputation_service: ReputationService):
        self.ml_client = ml_client
        self.reputation_service = reputation_service

    async def calculate_risk_score(self, 
                                 user_hash: str, 
                                 features: FeatureVector, 
                                 context: Optional[RiskContext] = None) -> RiskScore:
        factors: List[RiskFactor] = []
        
        # 1. Behavioral ML Probe with Fallback
        ml_prob = await self.ml_client.get_prediction_with_fallback(user_hash, features)
        ml_score = ml_prob * 100
        
        factors.append(RiskFactor(
            factor="behavioral_ml_inference",
            contribution=ml_score,
            description=f"ML Prob: {ml_prob:.4f} (from service or historical fallback)"
        ))

        # 2. Reputation Adjustment (Weighted)
        reputation = await self.reputation_service.get_reputation_score(user_hash)
        # Reputation of 100 (Human) reduces score by up to 20 points
        # Reputation of 0 (Bot) adds up to 20 points
        rep_contribution = (50 - reputation) * 0.4 
        
        factors.append(RiskFactor(
            factor="user_reputation",
            contribution=rep_contribution,
            description=f"Reputation: {reputation:.1f} (Aggregated 30-day consistency)"
        ))

        final_score = ml_score + rep_contribution

        # 3. Policy-based Multipliers (Bulk Purchase)
        if context and context.isBulkPurchase:
            pre_multiplier_score = final_score
            final_score *= 1.5 # 1.5x bulk purchase risk
            factors.append(RiskFactor(
                factor="bulk_purchase_policy",
                contribution=final_score - pre_multiplier_score,
                description=f"Multi-ticket purchase risk (Requested: {context.requestedQuantity})"
            ))

        # Clamping
        final_score = max(0.0, min(100.0, final_score))

        # Decision Mapping
        decision = DetectionResponseDecision.allow
        if final_score >= settings.RISK_THRESHOLD_BLOCK:
            decision = DetectionResponseDecision.block
        elif final_score >= settings.RISK_THRESHOLD_CHALLENGE:
            decision = DetectionResponseDecision.challenge

        # Log for Production Analytics (Requirement 4.4)
        logger.info(
            f"Risk Scoring - User: {user_hash[:8]}... "
            f"Result: {decision.value} "
            f"Score: {final_score:.2f} "
            f"Factors: {[f.factor for f in factors]}"
        )

        return RiskScore(
            score=final_score,
            factors=factors,
            decision=decision
        )
