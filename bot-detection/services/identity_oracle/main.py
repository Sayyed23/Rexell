import os
import time
import json
import urllib.request
from typing import Optional
from datetime import datetime, timedelta
from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy.orm import Session
from eth_account import Account
from eth_account.messages import encode_typed_data
from dotenv import load_dotenv

# Load configuration from multiple dotenv files to ensure synchronization
load_dotenv()
project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))

# Load root .env
root_env = os.path.join(project_root, ".env")
if os.path.exists(root_env):
    load_dotenv(root_env, override=True)

# Load frontend .env
frontend_env = os.path.join(project_root, "frontend", ".env")
if os.path.exists(frontend_env):
    load_dotenv(frontend_env, override=True)

from database import engine, get_db, Base
import models

# Create tables in MSSQL if they don't exist
Base.metadata.create_all(bind=engine)

app = FastAPI(title="Rexell Anti-Sybil Oracle")

# Add CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Allow all origins for local development
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Load Oracle Private Keys for 3-of-5 multisig
ORACLE_KEY_1 = os.getenv("ORACLE_PRIVATE_KEY_1", os.getenv("ORACLE_PRIVATE_KEY", "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"))
ORACLE_KEY_2 = os.getenv("ORACLE_PRIVATE_KEY_2", "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d")
ORACLE_KEY_3 = os.getenv("ORACLE_PRIVATE_KEY_3", "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a")

oracle_accounts = [
    Account.from_key(ORACLE_KEY_1),
    Account.from_key(ORACLE_KEY_2),
    Account.from_key(ORACLE_KEY_3)
]

print("\n--- Oracle Multi-Signer Addresses ---")
for idx, acc in enumerate(oracle_accounts):
    print(f"Signer {idx+1}: {acc.address}")
print("--------------------------------------\n")

# Smart Contract Domain Data for EIP-712 verification in Rexell.sol
DOMAIN_NAME = "Rexell"
DOMAIN_VERSION = "1"
CHAIN_ID = int(os.getenv("CHAIN_ID", "11142220")) # Celo Sepolia Testnet
REXELL_CONTRACT_ADDRESS = os.getenv("REXELL_CONTRACT_ADDRESS", os.getenv("NEXT_PUBLIC_REXELL_ADDRESS", "0xe2a17C1E49EB58b1296687E0eC1ba480Ad758B85"))
IDENTITY_CONTRACT_ADDRESS = os.getenv("IDENTITY_CONTRACT_ADDRESS", os.getenv("NEXT_PUBLIC_SOULBOUND_ADDRESS", "0x05541B5Eb98583c2342d520a39E9C9f64E4A9AFD"))

class IdentityRequestPayload(BaseModel):
    user_address: str
    scalper_probability: Optional[float] = None
    high_risk: Optional[bool] = None

def get_onchain_identity(user_address: str) -> dict:
    """
    Queries the SoulboundIdentity contract on Celo Sepolia for the user's identity struct.
    """
    if not IDENTITY_CONTRACT_ADDRESS or IDENTITY_CONTRACT_ADDRESS == "0x0000000000000000000000000000000000000000":
        return {"tokenId": 0, "stakeAmount": 0, "activeVouchesCount": 0}
        
    rpc_url = os.getenv("CELO_RPC_URL", "https://forno.celo-sepolia.celo-testnet.org")
    
    # Method signature for identities(address): 0x09bc30e4
    # Address is 20 bytes, padded to 32 bytes (64 characters)
    try:
        clean_addr = user_address.lower().replace("0x", "")
        padded_addr = clean_addr.zfill(64)
        data = "0x09bc30e4" + padded_addr
        
        payload = {
            "jsonrpc": "2.0",
            "method": "eth_call",
            "params": [
                {
                    "to": IDENTITY_CONTRACT_ADDRESS,
                    "data": data
                },
                "latest"
            ],
            "id": 1
        }
        
        req = urllib.request.Request(
            rpc_url,
            data=json.dumps(payload).encode("utf-8"),
            headers={"Content-Type": "application/json"}
        )
        with urllib.request.urlopen(req, timeout=5) as response:
            res = json.loads(response.read().decode("utf-8"))
            if "result" in res:
                result_hex = res["result"].replace("0x", "")
                if len(result_hex) >= 448: # 7 fields * 64 chars
                    token_id = int(result_hex[0:64], 16)
                    stake_amount = int(result_hex[64:128], 16)
                    active_vouches = int(result_hex[320:384], 16)
                    return {
                        "tokenId": token_id,
                        "stakeAmount": stake_amount,
                        "activeVouchesCount": active_vouches
                    }
    except Exception as e:
        print(f"Error querying on-chain identity: {e}")
        
    return {"tokenId": 0, "stakeAmount": 0, "activeVouchesCount": 0}

def calculate_composite_score(db: Session, user_address: str) -> dict:
    """
    Calculates the dynamic composite Anti-Sybil score for a user.
    """
    user_address_lower = user_address.lower()
    
    # 1. Fetch reputation from DB
    reputation = db.query(models.WalletReputation).filter(
        models.WalletReputation.wallet_address == user_address_lower
    ).first()
    
    # 2. Check if clustered and in cooldown
    cluster = db.query(models.FundingCluster).filter(
        models.FundingCluster.wallet_address == user_address_lower
    ).first()
    
    is_clustered = False
    cluster_size = 0
    if cluster and cluster.cluster_size > 1:
        is_clustered = True
        cluster_size = cluster.cluster_size
        
    in_cooldown = False
    cooldown_days_remaining = 0
    
    if is_clustered and reputation and reputation.first_tx_timestamp:
        # 14-day cooldown since first transaction/funding detection
        time_diff = datetime.utcnow() - reputation.first_tx_timestamp
        if time_diff < timedelta(days=14):
            in_cooldown = True
            cooldown_days_remaining = max(0, 14 - time_diff.days)
            
    if in_cooldown:
        return {
            "score": 40,
            "base_score": 10,
            "vouch_boost": 0,
            "stake_boost": 0,
            "is_clustered": True,
            "in_cooldown": True,
            "cooldown_days_remaining": cooldown_days_remaining
        }

    # 3. Compute base reputation score (max 80)
    base_score = 10
    has_ens = False
    has_poap = False
    wallet_age_days = 0
    tx_count = 0
    
    if reputation:
        has_ens = bool(reputation.has_ens)
        has_poap = bool(reputation.has_poap)
        if reputation.has_ens:
            base_score += 15
        if reputation.has_poap:
            base_score += 10
            
        # Age boost
        if reputation.first_tx_timestamp:
            wallet_age_days = (datetime.utcnow() - reputation.first_tx_timestamp).days
            if wallet_age_days > 180:
                base_score += 25
            elif wallet_age_days > 90:
                base_score += 15
            elif wallet_age_days > 30:
                base_score += 10
                
        # Tx count boost
        tx_count = reputation.total_tx_count or 0
        if tx_count > 100:
            base_score += 20
        elif tx_count > 50:
            base_score += 15
        elif tx_count > 10:
            base_score += 10
            
    # 4. Vouch boost (each active vouch adds 30)
    vouches_count = db.query(models.VouchGraph).filter(
        models.VouchGraph.vouchee_address == user_address_lower,
        models.VouchGraph.is_active == True
    ).count()
    vouch_boost = vouches_count * 30
    
    # 5. Stake boost (using on-chain stake amount from Celo)
    onchain_id = get_onchain_identity(user_address)
    stake_amount = onchain_id.get("stakeAmount", 0)
    base_stake_wei = 25 * 10**18
    stake_boost = int((stake_amount / base_stake_wei) * 30)
    
    composite_score = base_score + vouch_boost + stake_boost
    if composite_score > 100:
        composite_score = 100
        
    return {
        "score": composite_score,
        "base_score": base_score,
        "vouch_boost": vouch_boost,
        "stake_boost": stake_boost,
        "is_clustered": is_clustered,
        "in_cooldown": False,
        "cooldown_days_remaining": 0,
        "details": {
            "has_ens": has_ens,
            "has_poap": has_poap,
            "wallet_age_days": wallet_age_days,
            "tx_count": tx_count,
            "vouches_count": vouches_count,
            "stake_amount_cusd": float(stake_amount / 10**18)
        }
    }

@app.get("/")
def health_check():
    return {
        "status": "ok", 
        "oracle_signers": [acc.address for acc in oracle_accounts], 
        "database": "MSSQL Connected",
        "rexell_contract": REXELL_CONTRACT_ADDRESS,
        "identity_contract": IDENTITY_CONTRACT_ADDRESS
    }

@app.get("/api/identity/status")
def get_identity_status(user_address: str, db: Session = Depends(get_db)):
    try:
        status = calculate_composite_score(db, user_address)
        return status
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/identity/attest")
def generate_attestation(payload: IdentityRequestPayload, db: Session = Depends(get_db)):
    user_address = payload.user_address
    scalper_probability = payload.scalper_probability
    high_risk = payload.high_risk or (scalper_probability is not None and scalper_probability > 0.6)
    
    # 1. Calculate Composite Score
    status = calculate_composite_score(db, user_address)
    score = status["score"]
    
    # 2. Expiration (15 minutes)
    expires_at = int(time.time()) + 900
    
    # 3. Generate Nonce
    import secrets
    nonce = secrets.randbits(256)
    
    # 4. Construct EIP-712 Typed Data
    typed_data = {
        "types": {
            "EIP712Domain": [
                {"name": "name", "type": "string"},
                {"name": "version", "type": "string"},
                {"name": "chainId", "type": "uint256"},
                {"name": "verifyingContract", "type": "address"}
            ],
            "IdentityAttestation": [
                {"name": "user", "type": "address"},
                {"name": "score", "type": "uint256"},
                {"name": "expiresAt", "type": "uint256"},
                {"name": "nonce", "type": "uint256"}
            ]
        },
        "primaryType": "IdentityAttestation",
        "domain": {
            "name": DOMAIN_NAME,
            "version": DOMAIN_VERSION,
            "chainId": CHAIN_ID,
            "verifyingContract": REXELL_CONTRACT_ADDRESS
        },
        "message": {
            "user": user_address,
            "score": score,
            "expiresAt": expires_at,
            "nonce": nonce
        }
    }
    
    # 5. Sign with 3 private keys
    signatures_with_signers = []
    
    try:
        signable_message = encode_typed_data(full_message=typed_data)
        
        for acc in oracle_accounts:
            signed = acc.sign_message(signable_message)
            signatures_with_signers.append({
                "signer": acc.address,
                "signature": signed.signature.hex()
            })
            
        # Sort signatures by signer address to satisfy unique sorted check on-chain
        signatures_with_signers.sort(key=lambda x: x["signer"].lower())
        
        sorted_signatures = ["0x" + s["signature"] if not s["signature"].startswith("0x") else s["signature"] for s in signatures_with_signers]
        
        # Log AppActivity in database with high risk metadata tags
        try:
            db_activity = models.AppActivity(
                user_address=user_address.lower(),
                action="ATTESTATION_REQUESTED",
                details=json.dumps({
                    "scalper_probability": scalper_probability,
                    "high_risk": high_risk,
                    "score": score
                })
            )
            db.add(db_activity)
            db.commit()
        except Exception as log_exc:
            db.rollback()
            print(f"Error logging attestation activity: {log_exc}")

        return {
            "user": user_address,
            "score": score,
            "expiresAt": expires_at,
            "nonce": str(nonce),
            "signatures": sorted_signatures,
            "high_risk": bool(high_risk),
            "scalper_probability": scalper_probability
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/identity/request-signatures")
def get_request_signatures(payload: IdentityRequestPayload, db: Session = Depends(get_db)):
    user_address = payload.user_address
    
    # 1. Calculate risk multiplier
    reputation = db.query(models.WalletReputation).filter(
        models.WalletReputation.wallet_address == user_address.lower()
    ).first()
    
    base_multiplier = 100
    if reputation and reputation.reputation_score_base100 > 80:
        base_multiplier = 50
        
    cluster = db.query(models.FundingCluster).filter(
        models.FundingCluster.wallet_address == user_address.lower()
    ).first()
    
    if cluster and cluster.cluster_size > 5:
        base_multiplier = int(base_multiplier * cluster.cluster_penalty)
        if base_multiplier > 400:
            base_multiplier = 400
            
    timestamp = int(time.time())
    
    # Construct EIP-712 IdentityRequest
    typed_data = {
        "types": {
            "EIP712Domain": [
                {"name": "name", "type": "string"},
                {"name": "version", "type": "string"},
                {"name": "chainId", "type": "uint256"},
                {"name": "verifyingContract", "type": "address"}
            ],
            "IdentityRequest": [
                {"name": "user", "type": "address"},
                {"name": "riskMultiplier", "type": "uint256"},
                {"name": "timestamp", "type": "uint256"}
            ]
        },
        "primaryType": "IdentityRequest",
        "domain": {
            "name": "RexellIdentity",
            "version": "1",
            "chainId": CHAIN_ID,
            "verifyingContract": IDENTITY_CONTRACT_ADDRESS
        },
        "message": {
            "user": user_address,
            "riskMultiplier": base_multiplier,
            "timestamp": timestamp
        }
    }
    
    signatures_with_signers = []
    try:
        signable_message = encode_typed_data(full_message=typed_data)
        for acc in oracle_accounts:
            signed = acc.sign_message(signable_message)
            signatures_with_signers.append({
                "signer": acc.address,
                "signature": signed.signature.hex()
            })
        signatures_with_signers.sort(key=lambda x: x["signer"].lower())
        sorted_signatures = ["0x" + s["signature"] if not s["signature"].startswith("0x") else s["signature"] for s in signatures_with_signers]
        
        return {
            "user": user_address,
            "riskMultiplier": base_multiplier,
            "timestamp": timestamp,
            "signatures": sorted_signatures
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class ActivityLogPayload(BaseModel):
    user_address: str
    action: str
    tx_hash: str = None
    details: dict = None

@app.post("/api/activity/log")
def log_activity(payload: ActivityLogPayload, db: Session = Depends(get_db)):
    try:
        details_str = json.dumps(payload.details) if payload.details else None
        db_activity = models.AppActivity(
            user_address=payload.user_address.lower(),
            action=payload.action.upper(),
            tx_hash=payload.tx_hash,
            details=details_str
        )
        db.add(db_activity)
        
        # If the action is VOUCH, also record in VouchGraph to update dynamic scores
        if payload.action.upper() == "VOUCH" and payload.details:
            vouchee = payload.details.get("vouchee", "").lower()
            if vouchee:
                # Check if this vouch already exists to avoid duplicates
                existing = db.query(models.VouchGraph).filter(
                    models.VouchGraph.voucher_address == payload.user_address.lower(),
                    models.VouchGraph.vouchee_address == vouchee,
                    models.VouchGraph.is_active == True
                ).first()
                if not existing:
                    db_vouch = models.VouchGraph(
                        voucher_address=payload.user_address.lower(),
                        vouchee_address=vouchee,
                        is_active=True
                    )
                    db.add(db_vouch)
                    
        db.commit()
        return {"status": "success", "message": "Activity logged in SQL Server"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/activity/history")
def get_activity_history(db: Session = Depends(get_db)):
    try:
        activities = db.query(models.AppActivity).order_by(models.AppActivity.timestamp.desc()).all()
        return [
            {
                "id": a.id,
                "user_address": a.user_address,
                "action": a.action,
                "tx_hash": a.tx_hash,
                "details": json.loads(a.details) if a.details else {},
                "timestamp": a.timestamp.isoformat()
            }
            for a in activities
        ]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=5000)
