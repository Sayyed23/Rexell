import os
import sys
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from dotenv import load_dotenv

# Load models and database setup
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from database import engine, SessionLocal
import models

def format_row(columns, row):
    return " | ".join(f"{col}: {getattr(row, col)}" for col in columns)

def query_database():
    load_dotenv()
    db = SessionLocal()
    try:
        print("\n=== SYSTEM DATABASE INSPECTION (SQL SERVER) ===")
        
        # 1. Query App Activities (Transactions, Attestations, etc.)
        print("\n--- 1. APP ACTIVITIES (LAST 20 EVENTS) ---")
        activities = db.query(models.AppActivity).order_by(models.AppActivity.timestamp.desc()).limit(20).all()
        if not activities:
            print("No app activities found in database.")
        for idx, act in enumerate(activities):
            print(f"[{idx+1}] Timestamp: {act.timestamp} | User: {act.user_address} | Action: {act.action} | TxHash: {act.tx_hash}")
            if act.details:
                print(f"    Details: {act.details}")

        # 2. Query Wallet Reputations
        print("\n--- 2. WALLET REPUTATIONS ---")
        reputations = db.query(models.WalletReputation).limit(20).all()
        if not reputations:
            print("No wallet reputations found in database.")
        for idx, rep in enumerate(reputations):
            print(f"[{idx+1}] Address: {rep.wallet_address} | Score: {rep.reputation_score_base100} | Tx Count: {rep.total_tx_count} | ENS: {rep.has_ens} | POAP: {rep.has_poap}")

        # 3. Query Vouch Graph
        print("\n--- 3. VOUCH GRAPH (ACTIVE VOUCHES) ---")
        vouches = db.query(models.VouchGraph).filter(models.VouchGraph.is_active == True).limit(20).all()
        if not vouches:
            print("No active vouches found in database.")
        for idx, v in enumerate(vouches):
            print(f"[{idx+1}] Voucher: {v.voucher_address} -> Vouchee: {v.vouchee_address}")

        # 4. Query Funding Clusters
        print("\n--- 4. FUNDING CLUSTERS ---")
        clusters = db.query(models.FundingCluster).limit(20).all()
        if not clusters:
            print("No funding clusters found in database.")
        for idx, c in enumerate(clusters):
            print(f"[{idx+1}] Wallet: {c.wallet_address} | Source: {c.source_wallet} | Size: {c.cluster_size} | Penalty: {c.cluster_penalty}")

        print("\n===============================================\n")

    except Exception as e:
        print(f"Error querying database: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    query_database()
