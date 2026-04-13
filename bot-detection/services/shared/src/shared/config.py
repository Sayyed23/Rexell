from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import Optional

class Settings(BaseSettings):
    """
    Production-grade configuration for the Rexell Bot Detection system.
    Values can be overridden by environment variables (e.g. ML_INFERENCE_URL).
    """
    model_config = SettingsConfigDict(env_file='.env', env_file_encoding='utf-8', extra='ignore')

    # Component URLs
    ML_INFERENCE_URL: str = "http://ml-inference:8080"
    REDIS_URL: str = "redis://redis:6379/0"
    DATABASE_URL: str = "postgresql+asyncpg://postgres:postgres@db:5432/bot_detection"

    # Risk Thresholds (Requirement 1.2, 1.3, 2.1)
    RISK_THRESHOLD_BLOCK: float = 80.0
    RISK_THRESHOLD_CHALLENGE: float = 50.0

    # Fallback Values
    ML_FALLBACK_DEFAULT_SCORE: float = 60.0 # Conservative challenge per Requirement 4.2

    # Reputation Logic
    REPUTATION_CACHE_TTL_SECONDS: int = 300
    REPUTATION_MIN_SESSIONS_FOR_TRUST: int = 10
    REPUTATION_MAX_AVG_SCORE_FOR_TRUST: float = 20.0
    REPUTATION_CONSISTENCY_WINDOW_DAYS: int = 30

    # Client Performance
    ML_CLIENT_TIMEOUT_SECONDS: float = 0.5
    REDIS_POOL_SIZE: int = 10

settings = Settings()
