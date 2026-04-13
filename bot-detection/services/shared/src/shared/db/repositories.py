import uuid
from typing import Optional, List, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import update, delete

from .models import (
    BehavioralDataModel,
    RiskScoreModel,
    VerificationTokenModel,
    UserReputationModel,
    ChallengeStateModel,
    AuditLogModel
)
from shared.utils.crypto import hash_wallet_address
from shared.utils.time_utils import (
    current_timestamp,
    calculate_behavioral_data_expires_at,
    calculate_token_expires_at,
    calculate_challenge_expires_at
)

class DatabaseRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

class BehavioralDataRepository(DatabaseRepository):
    async def create(self, session_id: str, wallet_address: str, user_agent: str, ip_address: Optional[str], events: List[Dict[str, Any]]) -> BehavioralDataModel:
        user_hash = hash_wallet_address(wallet_address)
        record = BehavioralDataModel(
            id=str(uuid.uuid4()),
            session_id=session_id,
            user_hash=user_hash,
            user_agent=user_agent,
            ip_address=ip_address,
            events=events,
            created_at=current_timestamp(),
            expires_at=calculate_behavioral_data_expires_at()
        )
        self.session.add(record)
        await self.session.flush()
        return record

    async def get_by_session_id(self, session_id: str) -> Optional[BehavioralDataModel]:
        stmt = select(BehavioralDataModel).where(BehavioralDataModel.session_id == session_id)
        result = await self.session.execute(stmt)
        return result.scalars().first()
        
    async def get_by_user_hash(self, user_hash: str, limit: int = 100) -> List[BehavioralDataModel]:
        stmt = select(BehavioralDataModel).where(BehavioralDataModel.user_hash == user_hash).order_by(BehavioralDataModel.created_at.desc()).limit(limit)
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

class RiskScoreRepository(DatabaseRepository):
    async def create(self, session_id: str, user_hash: str, score: float, decision: str, factors: List[Dict[str, Any]], behavioral_data_id: Optional[str] = None) -> RiskScoreModel:
        record = RiskScoreModel(
            id=str(uuid.uuid4()),
            behavioral_data_id=behavioral_data_id,
            user_hash=user_hash,
            session_id=session_id,
            score=score,
            decision=decision,
            factors=factors,
            created_at=current_timestamp()
        )
        self.session.add(record)
        await self.session.flush()
        return record
        
    async def get_latest_by_user_hash(self, user_hash: str, limit: int = 1) -> List[RiskScoreModel]:
        stmt = select(RiskScoreModel).where(RiskScoreModel.user_hash == user_hash).order_by(RiskScoreModel.created_at.desc()).limit(limit)
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

class VerificationTokenRepository(DatabaseRepository):
    async def create(self, user_hash: str, event_id: Optional[str] = None, max_quantity: Optional[int] = None) -> VerificationTokenModel:
        record = VerificationTokenModel(
            token_id=str(uuid.uuid4()),
            user_hash=user_hash,
            event_id=event_id,
            max_quantity=max_quantity,
            issued_at=current_timestamp(),
            expires_at=calculate_token_expires_at()
        )
        self.session.add(record)
        await self.session.flush()
        return record

    async def get_by_id(self, token_id: str) -> Optional[VerificationTokenModel]:
        stmt = select(VerificationTokenModel).where(VerificationTokenModel.token_id == token_id)
        result = await self.session.execute(stmt)
        return result.scalars().first()

    async def consume(self, token_id: str, tx_hash: str) -> bool:
        stmt = (
            update(VerificationTokenModel)
            .where(VerificationTokenModel.token_id == token_id)
            .where(VerificationTokenModel.consumed_at.is_(None))
            .values(consumed_at=current_timestamp(), tx_hash=tx_hash)
        )
        result = await self.session.execute(stmt)
        return result.rowcount > 0

class UserReputationRepository(DatabaseRepository):
    async def get_or_create(self, user_hash: str) -> UserReputationModel:
        stmt = select(UserReputationModel).where(UserReputationModel.user_hash == user_hash)
        result = await self.session.execute(stmt)
        record = result.scalars().first()
        
        if not record:
            now = current_timestamp()
            record = UserReputationModel(
                user_hash=user_hash,
                reputation_score=100.0,
                created_at=now,
                updated_at=now
            )
            self.session.add(record)
            await self.session.flush()
            
        return record

    async def update_score(self, user_hash: str, new_score: float, trusted_status: Optional[bool] = None, flagged: Optional[bool] = None) -> None:
        values: Dict[str, Any] = {"reputation_score": new_score, "updated_at": current_timestamp()}
        if trusted_status is not None:
            values["trusted_status"] = trusted_status
        if flagged is not None:
            values["flagged"] = flagged
            
        stmt = update(UserReputationModel).where(UserReputationModel.user_hash == user_hash).values(**values)
        await self.session.execute(stmt)

class ChallengeStateRepository(DatabaseRepository):
    async def create(self, user_hash: str, session_id: str, challenge_type: str) -> ChallengeStateModel:
        record = ChallengeStateModel(
            challenge_id=str(uuid.uuid4()),
            user_hash=user_hash,
            session_id=session_id,
            challenge_type=challenge_type,
            status="pending",
            attempts=0,
            created_at=current_timestamp(),
            expires_at=calculate_challenge_expires_at()
        )
        self.session.add(record)
        await self.session.flush()
        return record

    async def get_by_id(self, challenge_id: str) -> Optional[ChallengeStateModel]:
        stmt = select(ChallengeStateModel).where(ChallengeStateModel.challenge_id == challenge_id)
        result = await self.session.execute(stmt)
        return result.scalars().first()

    async def update_status(self, challenge_id: str, status: str, increment_attempts: bool = False) -> None:
        values: Dict[str, Any] = {"status": status}
        if increment_attempts:
            values["attempts"] = ChallengeStateModel.attempts + 1
            
        stmt = update(ChallengeStateModel).where(ChallengeStateModel.challenge_id == challenge_id).values(**values)
        await self.session.execute(stmt)

class AuditLogRepository(DatabaseRepository):
    async def create(self, accessor_identity: str, operation_type: str, resource_type: str, resource_id: Optional[str] = None, details: Optional[Dict[str, Any]] = None) -> AuditLogModel:
        record = AuditLogModel(
            id=str(uuid.uuid4()),
            timestamp=current_timestamp(),
            accessor_identity=accessor_identity,
            operation_type=operation_type,
            resource_type=resource_type,
            resource_id=resource_id,
            details=details
        )
        self.session.add(record)
        await self.session.flush()
        return record
