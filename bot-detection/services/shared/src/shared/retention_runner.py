"""
Async entrypoint used by the retention CronJob to purge expired rows.
"""

from __future__ import annotations

import asyncio
import logging
import os

from .config import settings
from .db.session import get_engine, get_session_maker
from .retention import enforce_retention


async def main() -> None:
    logging.basicConfig(level=os.getenv("LOG_LEVEL", "INFO"))
    engine = get_engine(os.getenv("DATABASE_URL", settings.DATABASE_URL))
    sm = get_session_maker(engine)
    try:
        async with sm() as session:
            await enforce_retention(session)
    finally:
        await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
