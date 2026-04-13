import time

# Retention Constants
BEHAVIORAL_DATA_TTL_DAYS = 90
CHALLENGE_STATE_TTL_MINUTES = 15
VERIFICATION_TOKEN_TTL_MINUTES = 5

def current_timestamp() -> int:
    """Returns the current UNIX timestamp (seconds)."""
    return int(time.time())

def current_timestamp_ms() -> int:
    """Returns the current UNIX timestamp in milliseconds."""
    return int(time.time() * 1000)

def calculate_expires_at(days: int = 0, hours: int = 0, minutes: int = 0, seconds: int = 0) -> int:
    """
    Calculates the expiration UNIX timestamp based on the present time plus offsets.
    """
    offset_seconds = days * 86400 + hours * 3600 + minutes * 60 + seconds
    return current_timestamp() + offset_seconds

def calculate_behavioral_data_expires_at() -> int:
    """Calculates expires_at for behavioral data (90-day TTL)."""
    return calculate_expires_at(days=BEHAVIORAL_DATA_TTL_DAYS)

def calculate_token_expires_at() -> int:
    """Calculates expires_at for verification tokens (5-minute TTL)."""
    return calculate_expires_at(minutes=VERIFICATION_TOKEN_TTL_MINUTES)

def calculate_challenge_expires_at() -> int:
    """Calculates expires_at for challenge states (15-minute TTL)."""
    return calculate_expires_at(minutes=CHALLENGE_STATE_TTL_MINUTES)
