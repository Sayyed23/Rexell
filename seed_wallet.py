import sys
import sqlite3
import os
import datetime

def main():
    if len(sys.argv) < 2:
        print("Usage: python seed_wallet.py <wallet_address>")
        sys.exit(1)
        
    address = sys.argv[1].lower().strip()
    
    # Path to the SQLite database
    db_path = os.path.join(os.path.dirname(__file__), "bot-detection", "services", "identity_oracle", "identity_oracle.db")
    if not os.path.exists(db_path):
        print(f"Error: Database not found at {db_path}")
        print("Make sure you have started the identity oracle server first so it creates the database.")
        sys.exit(1)
        
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # Verify table exists
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='wallet_reputation'")
    if not cursor.fetchone():
        print("Error: Table 'wallet_reputation' does not exist in the database.")
        conn.close()
        sys.exit(1)
        
    # Check if the wallet already has a reputation record
    cursor.execute("SELECT id FROM wallet_reputation WHERE wallet_address = ?", (address,))
    row = cursor.fetchone()
    
    # Simulate a mature wallet (>180 days age)
    past_date = (datetime.datetime.utcnow() - datetime.timedelta(days=200)).strftime('%Y-%m-%d %H:%M:%S.%f')
    
    if row:
        cursor.execute("""
            UPDATE wallet_reputation 
            SET has_ens = 1, has_poap = 1, total_tx_count = 150, reputation_score_base100 = 95, first_tx_timestamp = ?
            WHERE wallet_address = ?
        """, (past_date, address))
        print(f"Successfully UPDATED reputation for wallet: {address}")
    else:
        cursor.execute("""
            INSERT INTO wallet_reputation (wallet_address, first_tx_timestamp, total_tx_count, has_ens, has_poap, reputation_score_base100)
            VALUES (?, ?, 150, 1, 1, 95)
        """, (address, past_date))
        print(f"Successfully INSERTED high reputation score for wallet: {address}")
        
    conn.commit()
    conn.close()
    print("Anti-Sybil verification score is now seeded (score >= 70). Try purchasing again!")

if __name__ == "__main__":
    main()
