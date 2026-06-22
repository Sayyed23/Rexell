from sqlalchemy import Column, Integer, String, Boolean, DateTime, Float
from database import Base
import datetime

class WalletReputation(Base):
    __tablename__ = "wallet_reputation"

    id = Column(Integer, primary_key=True, index=True)
    wallet_address = Column(String(42), unique=True, index=True, nullable=False)
    first_tx_timestamp = Column(DateTime, default=datetime.datetime.utcnow)
    total_tx_count = Column(Integer, default=0)
    has_ens = Column(Boolean, default=False)
    has_poap = Column(Boolean, default=False)
    reputation_score_base100 = Column(Integer, default=100) # Precomputed by the indexer

class FundingCluster(Base):
    __tablename__ = "funding_clusters"

    id = Column(Integer, primary_key=True, index=True)
    wallet_address = Column(String(42), unique=True, index=True, nullable=False)
    source_wallet = Column(String(42), index=True, nullable=False)
    cluster_size = Column(Integer, default=1) # Number of wallets funded by this source_wallet recently
    cluster_penalty = Column(Float, default=1.0) # Multiplier for the stake (e.g., 4.0 for a large cluster)

class VouchGraph(Base):
    __tablename__ = "vouch_graph"

    id = Column(Integer, primary_key=True, index=True)
    voucher_address = Column(String(42), index=True, nullable=False)
    vouchee_address = Column(String(42), index=True, nullable=False)
    is_active = Column(Boolean, default=True)

class AppActivity(Base):
    __tablename__ = "app_activities"

    id = Column(Integer, primary_key=True, index=True)
    user_address = Column(String(42), index=True, nullable=False)
    action = Column(String(50), nullable=False) # e.g., MINT_IDENTITY, BUY_TICKET, VOUCH, TOPUP_STAKE, etc.
    tx_hash = Column(String(66), nullable=True)
    details = Column(String(500), nullable=True) # JSON string with extra details
    timestamp = Column(DateTime, default=datetime.datetime.utcnow)
