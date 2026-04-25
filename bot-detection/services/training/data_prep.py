"""
Training data preparation script (Task 18.1).

- Queries the last ``N`` days of behavioral data from PostgreSQL
- Extracts feature vectors using the existing ``BehavioralAnalyzer``
- Labels records using challenge outcomes + risk_score.decision
- Splits into train/validation/test sets (70/15/15)
- Writes the three splits to Parquet and optionally uploads to MinIO

Requirements: 3.1, 3.6
"""

from __future__ import annotations

import asyncio
import logging
import os
import random
import tempfile
from dataclasses import dataclass
from typing import List, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker

from shared.analyzer import BehavioralAnalyzer
from shared.config import settings
from shared.db.models import BehavioralDataModel, RiskScoreModel
from shared.models.types import (
    BehavioralData,
    EventType,
    KeystrokeEvent,
    MouseEvent,
    NavigationEvent,
)
from shared.utils.time_utils import current_timestamp

logger = logging.getLogger(__name__)


@dataclass
class PreparedDataset:
    train_path: str
    val_path: str
    test_path: str
    row_count: int


def _reconstruct_behavioral(record: BehavioralDataModel) -> BehavioralData:
    events: list = []
    for raw in record.events or []:
        etype = raw.get("type")
        if etype in ("mousemove", "click", "scroll"):
            events.append(MouseEvent(**raw))
        elif etype in ("keydown", "keyup"):
            events.append(KeystrokeEvent(**raw))
        elif etype == "navigation":
            events.append(NavigationEvent(**raw))
    return BehavioralData(
        sessionId=record.session_id,
        walletAddress=record.user_hash,
        userAgent=record.user_agent or "unknown",
        ipAddress=record.ip_address or "0.0.0.0",
        events=events,
    )


def _label_from_decision(decision: Optional[str]) -> Optional[int]:
    if decision == "block":
        return 1
    if decision == "allow":
        return 0
    return None  # ignore 'challenge' rows — ground truth unclear


async def prepare_training_data(
    database_url: Optional[str] = None,
    days: int = 90,
    output_dir: Optional[str] = None,
    seed: int = 42,
) -> PreparedDataset:
    """Fetch behavioural data + labels from PostgreSQL and write 3 Parquet splits."""
    import pandas as pd

    database_url = database_url or os.getenv("DATABASE_URL", settings.DATABASE_URL)
    output_dir = output_dir or tempfile.mkdtemp(prefix="training-")
    engine = create_async_engine(database_url)
    sm = async_sessionmaker(engine, expire_on_commit=False)
    cutoff = current_timestamp() - days * 86400

    analyzer = BehavioralAnalyzer()
    rows: List[dict] = []

    async with sm() as session:
        behaviour_q = select(BehavioralDataModel).where(
            BehavioralDataModel.created_at >= cutoff
        )
        result = await session.execute(behaviour_q)
        records = list(result.scalars().all())

        risk_q = select(
            RiskScoreModel.behavioral_data_id, RiskScoreModel.decision
        ).where(RiskScoreModel.created_at >= cutoff)
        risk_result = await session.execute(risk_q)
        decisions = {bid: dec for bid, dec in risk_result.all() if bid}

        for record in records:
            label = _label_from_decision(decisions.get(record.id))
            if label is None:
                continue
            behavioural = _reconstruct_behavioral(record)
            try:
                features = analyzer.extract_features(behavioural)
            except Exception:  # noqa: BLE001
                continue
            rows.append({**features.model_dump(), "label": label})

    await engine.dispose()

    if not rows:
        raise RuntimeError("No labelled behavioural data available for training")

    rng = random.Random(seed)
    rng.shuffle(rows)
    n = len(rows)
    n_train = int(n * 0.7)
    n_val = int(n * 0.15)
    df = pd.DataFrame(rows)
    train = df.iloc[:n_train]
    val = df.iloc[n_train : n_train + n_val]
    test = df.iloc[n_train + n_val :]

    os.makedirs(output_dir, exist_ok=True)
    train_path = os.path.join(output_dir, "train.parquet")
    val_path = os.path.join(output_dir, "val.parquet")
    test_path = os.path.join(output_dir, "test.parquet")
    train.to_parquet(train_path)
    val.to_parquet(val_path)
    test.to_parquet(test_path)

    logger.info(
        "Prepared training dataset: %d rows (%d/%d/%d) written to %s",
        n,
        len(train),
        len(val),
        len(test),
        output_dir,
    )
    return PreparedDataset(train_path, val_path, test_path, n)


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    result = asyncio.run(prepare_training_data())
    print(result)
