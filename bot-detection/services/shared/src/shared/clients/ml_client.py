import httpx
import logging
import time
from typing import Dict, Any, Optional, List
from tenacity import (
    retry,
    stop_after_attempt,
    wait_exponential,
    retry_if_exception_type
)
from ..models.types import FeatureVector
from ..config import settings
from ..db.repositories import RiskScoreRepository

logger = logging.getLogger(__name__)

class MLInferenceClient:
    """
    Production-grade ML client with connection pooling, circuit breaking, 
    and historical fallback logic.
    """
    def __init__(self, 
                 http_client: httpx.AsyncClient, 
                 repository: Optional[RiskScoreRepository] = None):
        self.client = http_client
        self.repo = repository
        
        # Circuit Breaker state
        self.failure_count = 0
        self.max_failures = 5
        self.circuit_open_until = 0
        self.cool_off_period = 60 # seconds

    def _is_circuit_open(self) -> bool:
        if self.failure_count >= self.max_failures:
            if time.time() < self.circuit_open_until:
                return True
            self.failure_count = 0 # Reset after cool-off
        return False

    def _record_failure(self):
        self.failure_count += 1
        if self.failure_count >= self.max_failures:
            self.circuit_open_until = time.time() + self.cool_off_period
            logger.error(f"ML Client circuit opened for {self.cool_off_period}s")

    def _record_success(self):
        self.failure_count = 0

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=0.1, max=1),
        retry=retry_if_exception_type(httpx.RequestError),
        reraise=True
    )
    async def get_prediction(self, features: FeatureVector) -> float:
        """Calls ML service with pooling and retries."""
        if self._is_circuit_open():
            raise httpx.RequestError("Circuit breaker open")

        try:
            response = await self.client.post(
                "/predictions",
                json={"features": features.model_dump()},
                timeout=settings.ML_CLIENT_TIMEOUT_SECONDS
            )
            
            if response.status_code != 200:
                self._record_failure()
                response.raise_for_status()
            
            self._record_success()
            data = response.json()
            return float(data.get("probability", 0.0))
        
        except (httpx.RequestError, httpx.HTTPStatusError) as e:
            self._record_failure()
            logger.error(f"ML Inference call failed: {str(e)}")
            raise

    async def get_prediction_with_fallback(self, 
                                          user_hash: str, 
                                          features: FeatureVector) -> float:
        """
        Implements Requirement: Fallback to last known behavior score if ML is down.
        """
        try:
            return await self.get_prediction(features)
        except Exception as e:
            logger.warning(f"ML Inference Service unavailable ({str(e)}). Attempting historical fallback...")
            
            if self.repo:
                # Get the latest score from the database for this user
                history = await self.repo.get_latest_by_user_hash(user_hash, limit=1)
                if history:
                    last_score = history[0].score
                    logger.info(f"Fallback to last known risk score: {last_score:.2f}")
                    return last_score / 100.0 # Convert back to probability 0-1
            
            # Absolute fallback if no history exists either
            logger.info(f"No history found. Using default fallback: {settings.ML_FALLBACK_DEFAULT_SCORE/100.0}")
            return settings.ML_FALLBACK_DEFAULT_SCORE / 100.0
