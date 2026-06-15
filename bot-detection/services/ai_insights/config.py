"""Configuration for the AI Insights service.

All values are read from environment variables with sensible defaults so the
service can run locally with zero configuration.
"""

import os
from pathlib import Path

_SERVICE_DIR = Path(__file__).resolve().parent
_REPO_ROOT = _SERVICE_DIR.parents[2]  # bot-detection/services/ai-insights -> repo root

from dotenv import load_dotenv
load_dotenv(_REPO_ROOT / ".env")
load_dotenv(_SERVICE_DIR / ".env")


class Settings:
    """Runtime settings sourced from the environment."""

    # Server
    LOG_LEVEL: str = os.getenv("LOG_LEVEL", "INFO")

    # Auth — comma separated list of accepted X-API-Key values
    API_KEYS: str = os.getenv("AI_INSIGHTS_API_KEYS", "")
    API_KEY: str = os.getenv("AI_INSIGHTS_API_KEY", "")
    DEV_MODE: bool = os.getenv("AI_INSIGHTS_DEV_MODE", "true").lower() == "true"
    DEV_API_KEY: str = "dev-ai-insights-key"

    # Forecast model
    MODEL_DIR: Path = Path(os.getenv("AI_INSIGHTS_MODEL_DIR", str(_SERVICE_DIR / "models")))
    LSTM_MODEL_FILE: str = os.getenv("AI_INSIGHTS_LSTM_FILE", "resale_lstm.keras")
    SCALER_FILE: str = os.getenv("AI_INSIGHTS_SCALER_FILE", "resale_scaler.json")
    EVENT_STATS_FILE: str = os.getenv("AI_INSIGHTS_EVENT_STATS_FILE", "event_stats.json")

    # Training data
    DATASET_CSV: Path = Path(
        os.getenv(
            "AI_INSIGHTS_DATASET_CSV",
            str(_REPO_ROOT / "dataset" / "blockchain_ticketing_master.csv"),
        )
    )

    # RAG
    RAG_DOCS_DIR: Path = Path(os.getenv("AI_INSIGHTS_RAG_DOCS_DIR", str(_REPO_ROOT)))
    HUGGINGFACEHUB_API_TOKEN: str = os.getenv("HUGGINGFACEHUB_API_TOKEN", "")
    RAG_LLM_REPO_ID: str = os.getenv(
        "AI_INSIGHTS_RAG_LLM", "mistralai/Mistral-7B-Instruct-v0.2"
    )
    RAG_EMBED_MODEL: str = os.getenv(
        "AI_INSIGHTS_RAG_EMBED_MODEL", "sentence-transformers/all-MiniLM-L6-v2"
    )

    # Ollama
    OLLAMA_BASE_URL: str = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
    OLLAMA_MODEL: str = os.getenv("OLLAMA_MODEL", "mistral")

    @property
    def valid_api_keys(self) -> set:
        keys: set = set()
        if self.API_KEYS:
            keys.update(k.strip() for k in self.API_KEYS.split(",") if k.strip())
        if self.API_KEY:
            keys.add(self.API_KEY.strip())
        if not keys and self.DEV_MODE:
            keys.add(self.DEV_API_KEY)
        return keys


settings = Settings()
