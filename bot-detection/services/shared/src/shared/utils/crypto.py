import hashlib
import os

# Salt should be provided via environment variables in production
# Fallback to a default salt for local dev only if absolutely necessary
SALT = os.getenv("WALLET_SALT", "rexell_default_salt")

def hash_wallet_address(wallet_address: str) -> str:
    """
    Hashes a wallet address using SHA-256 + salt to anonymize PII.
    
    Args:
        wallet_address: The raw wallet address (e.g. 0x...)
        
    Returns:
        A SHA-256 hex string representing the hashed user identity.
    """
    if not wallet_address:
        return ""
    
    # Normalize address (lowercase) to ensure consistent hashing
    normalized_address = wallet_address.strip().lower()
    content_to_hash = f"{normalized_address}:{SALT}".encode('utf-8')
    
    return hashlib.sha256(content_to_hash).hexdigest()
