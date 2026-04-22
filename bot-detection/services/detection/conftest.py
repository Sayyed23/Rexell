"""
Pytest configuration for the Detection Service.

Configures PYTHONPATH to include the shared module directory,
allowing imports like `from shared.models.types import ...`.
"""

import sys
from pathlib import Path

# Add services/shared/src to sys.path for shared module imports
shared_src = Path(__file__).parent.parent / "shared" / "src"
if shared_src.exists() and str(shared_src) not in sys.path:
    sys.path.insert(0, str(shared_src))
