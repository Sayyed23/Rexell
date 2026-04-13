from datetime import datetime
from sqlalchemy import Column, String, Float, Integer, BigInteger, Boolean, JSON, Index, ForeignKey
from sqlalchemy.orm import declarative_base

Base = declarative_base()

class BehavioralDataModel(Base):
    __tablename__ = 'behavioral_data'

    id = Column(String, primary_key=True)
    session_id = Column(String, index=True, nullable=False)
    user_hash = Column(String, index=True, nullable=False) # Hashed wallet address
    user_agent = Column(String, nullable=False)
    ip_address = Column(String, nullable=True) # Truncated IP
    events = Column(JSON, nullable=False)
    created_at = Column(BigInteger, nullable=False) # UNIX timestamp
    expires_at = Column(BigInteger, nullable=False, index=True) # created_at + 90 days

class RiskScoreModel(Base):
    __tablename__ = 'risk_scores'

    id = Column(String, primary_key=True)
    behavioral_data_id = Column(String, ForeignKey('behavioral_data.id'), nullable=True)
    user_hash = Column(String, index=True, nullable=False)
    session_id = Column(String, index=True, nullable=False)
    score = Column(Float, nullable=False)
    decision = Column(String, nullable=False) # allow, challenge, block
    factors = Column(JSON, nullable=False)
    created_at = Column(BigInteger, nullable=False)

class VerificationTokenModel(Base):
    __tablename__ = 'verification_tokens'

    token_id = Column(String, primary_key=True)
    user_hash = Column(String, index=True, nullable=False)
    event_id = Column(String, nullable=True)
    max_quantity = Column(Integer, nullable=True)
    issued_at = Column(BigInteger, nullable=False)
    expires_at = Column(BigInteger, nullable=False, index=True) # issued_at + 5 minutes
    consumed_at = Column(BigInteger, nullable=True)
    tx_hash = Column(String, nullable=True)

class UserReputationModel(Base):
    __tablename__ = 'user_reputation'

    user_hash = Column(String, primary_key=True)
    reputation_score = Column(Float, nullable=False, default=100.0)
    trusted_status = Column(Boolean, nullable=False, default=False)
    flagged = Column(Boolean, nullable=False, default=False)
    created_at = Column(BigInteger, nullable=False)
    updated_at = Column(BigInteger, nullable=False)

class ChallengeStateModel(Base):
    __tablename__ = 'challenge_state'

    challenge_id = Column(String, primary_key=True)
    user_hash = Column(String, index=True, nullable=False)
    session_id = Column(String, index=True, nullable=False)
    challenge_type = Column(String, nullable=False)
    status = Column(String, nullable=False) # pending, success, failed, expired
    attempts = Column(Integer, nullable=False, default=0)
    created_at = Column(BigInteger, nullable=False)
    expires_at = Column(BigInteger, nullable=False, index=True)

class AuditLogModel(Base):
    __tablename__ = 'audit_log'

    id = Column(String, primary_key=True)
    timestamp = Column(BigInteger, nullable=False, index=True)
    accessor_identity = Column(String, nullable=False) # API key hash or service name
    operation_type = Column(String, nullable=False) # READ, DELETE, etc.
    resource_type = Column(String, nullable=False) # e.g. behavioral_data
    resource_id = Column(String, nullable=True)
    details = Column(JSON, nullable=True)
