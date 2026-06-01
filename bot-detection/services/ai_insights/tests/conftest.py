"""Pytest configuration for the AI Insights service.

Ensures the ``services`` directory is importable (so ``import ai_insights``
works) and enables dev-mode auth.
"""

import os
import sys
from pathlib import Path

# services/ai_insights/tests -> services
services_dir = Path(__file__).resolve().parents[2]
if str(services_dir) not in sys.path:
    sys.path.insert(0, str(services_dir))

os.environ.setdefault("AI_INSIGHTS_DEV_MODE", "true")
os.environ.setdefault("LOG_LEVEL", "WARNING")
