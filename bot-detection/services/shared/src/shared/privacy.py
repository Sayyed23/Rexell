"""
Privacy and compliance utilities for the Rexell bot-detection platform.

Implements Task 22:

- IP address truncation to /24 (IPv4) or /48 (IPv6)
- User-agent normalization to the browser family only
- Log-safe PII scrubbing helpers
- Retention-policy constants

Wallet-address hashing already lives in ``shared.utils.crypto`` and is
re-exported here for convenience.

Requirements: 9.1, 9.4, 9.5, 11.2, 11.5
"""

from __future__ import annotations

import ipaddress
import re
from typing import Dict, Iterable, Optional

from .utils.crypto import hash_wallet_address

BEHAVIORAL_DATA_RETENTION_DAYS = 90
LOG_RETENTION_DAYS = 30
AUDIT_LOG_RETENTION_DAYS = 7 * 365

_BROWSER_FAMILIES: tuple[tuple[str, str], ...] = (
    ("Edg/", "edge"),
    ("OPR/", "opera"),
    ("Chrome/", "chrome"),
    ("Firefox/", "firefox"),
    ("Safari/", "safari"),
    ("curl/", "curl"),
    ("Go-http-client", "go-http"),
    ("Python-urllib", "python-urllib"),
    ("PostmanRuntime", "postman"),
)


def truncate_ip_address(ip: Optional[str]) -> Optional[str]:
    """Truncate an IP address so no full address is persisted.

    IPv4 → /24 (last octet zeroed out); IPv6 → /48.
    Invalid addresses return ``None``.
    """
    if not ip:
        return None
    try:
        addr = ipaddress.ip_address(ip.strip())
    except ValueError:
        return None
    if isinstance(addr, ipaddress.IPv4Address):
        network = ipaddress.ip_network(f"{addr}/24", strict=False)
    else:
        network = ipaddress.ip_network(f"{addr}/48", strict=False)
    return str(network.network_address)


def normalize_user_agent(ua: Optional[str]) -> str:
    """Reduce a user-agent string to its browser family only."""
    if not ua:
        return "unknown"
    for needle, family in _BROWSER_FAMILIES:
        if needle.lower() in ua.lower():
            return family
    return "other"


_WALLET_RE = re.compile(r"0x[a-fA-F0-9]{40}")
_IPV4_RE = re.compile(r"\b(?:\d{1,3}\.){3}\d{1,3}\b")


def scrub_log_value(value: str) -> str:
    """Remove obvious wallet addresses and IPv4 addresses from free-text logs."""
    value = _WALLET_RE.sub("<wallet>", value)
    value = _IPV4_RE.sub("<ip>", value)
    return value


def scrub_event_metadata(metadata: Dict[str, object]) -> Dict[str, object]:
    """Return a copy of ``metadata`` with PII-looking fields redacted."""
    redacted: Dict[str, object] = {}
    for key, value in metadata.items():
        if not isinstance(value, str):
            redacted[key] = value
            continue
        redacted[key] = scrub_log_value(value)
    return redacted


def anonymize_behavioral_payload(
    wallet_address: str,
    ip_address: Optional[str],
    user_agent: Optional[str],
) -> Dict[str, Optional[str]]:
    """Convenience helper returning the fully anonymised trio."""
    return {
        "user_hash": hash_wallet_address(wallet_address),
        "ip_address": truncate_ip_address(ip_address),
        "user_agent": normalize_user_agent(user_agent),
    }


__all__ = [
    "BEHAVIORAL_DATA_RETENTION_DAYS",
    "LOG_RETENTION_DAYS",
    "AUDIT_LOG_RETENTION_DAYS",
    "anonymize_behavioral_payload",
    "hash_wallet_address",
    "normalize_user_agent",
    "scrub_event_metadata",
    "scrub_log_value",
    "truncate_ip_address",
]
