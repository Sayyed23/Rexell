"""
Pytest configuration for the Challenge Service tests.

Adds the shared package's src directory to sys.path so that
`from shared.models.types import ...` works without installing the package.
"""

import sys
import os

# Add the shared package src directory to the path
_shared_src = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "shared", "src")
)
if _shared_src not in sys.path:
    sys.path.insert(0, _shared_src)

# Add the services directory so that `from challenge.xxx import ...` works
_services_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if _services_dir not in sys.path:
    sys.path.insert(0, _services_dir)
