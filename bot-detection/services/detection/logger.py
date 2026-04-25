"""
Structured logging setup for the Detection Service.

Provides JSON-formatted structured logging with:
- Correlation ID support for distributed tracing
- Wallet address anonymization (user_hash only, never raw address)
- Severity levels mapped to detection events
- structlog integration with stdlib logging fallback

Requirements: 1.5, 8.1, 9.4
"""

import logging
import sys
import uuid
from contextvars import ContextVar
from typing import Optional

try:
    import structlog

    _STRUCTLOG_AVAILABLE = True
except ImportError:
    _STRUCTLOG_AVAILABLE = False

# Context variable for correlation ID propagation across async tasks
_correlation_id_var: ContextVar[str] = ContextVar("correlation_id", default="")


def get_correlation_id() -> str:
    """Return the current correlation ID, or an empty string if not set."""
    return _correlation_id_var.get("")


def set_correlation_id(correlation_id: Optional[str] = None) -> str:
    """
    Set the correlation ID for the current async context.

    If no ID is provided, a new UUID4 is generated.

    Returns:
        The correlation ID that was set.
    """
    cid = correlation_id or str(uuid.uuid4())
    _correlation_id_var.set(cid)
    return cid


def _add_correlation_id(logger, method_name, event_dict):  # noqa: ARG001
    """structlog processor: inject correlation_id into every log record."""
    cid = get_correlation_id()
    if cid:
        event_dict["correlation_id"] = cid
    return event_dict


def configure_logging(log_level: str = "INFO") -> None:
    """
    Configure structured JSON logging for the Detection Service.

    When structlog is available, uses structlog with JSON rendering.
    Falls back to stdlib logging with a JSON formatter otherwise.

    Args:
        log_level: Logging level string (DEBUG, INFO, WARNING, ERROR, CRITICAL).
    """
    level = getattr(logging, log_level.upper(), logging.INFO)

    if _STRUCTLOG_AVAILABLE:
        structlog.configure(
            processors=[
                structlog.contextvars.merge_contextvars,
                structlog.processors.add_log_level,
                structlog.processors.TimeStamper(fmt="iso"),
                _add_correlation_id,
                structlog.processors.StackInfoRenderer(),
                structlog.processors.format_exc_info,
                structlog.processors.JSONRenderer(),
            ],
            wrapper_class=structlog.make_filtering_bound_logger(level),
            context_class=dict,
            logger_factory=structlog.PrintLoggerFactory(sys.stdout),
            cache_logger_on_first_use=True,
        )
    else:
        # Stdlib fallback with JSON formatter
        try:
            from pythonjsonlogger import jsonlogger  # type: ignore

            handler = logging.StreamHandler(sys.stdout)
            formatter = jsonlogger.JsonFormatter(
                "%(asctime)s %(name)s %(levelname)s %(message)s"
            )
            handler.setFormatter(formatter)
        except ImportError:
            handler = logging.StreamHandler(sys.stdout)
            handler.setFormatter(
                logging.Formatter(
                    '{"time":"%(asctime)s","name":"%(name)s","level":"%(levelname)s","message":"%(message)s"}'
                )
            )

        root = logging.getLogger()
        root.handlers.clear()
        root.addHandler(handler)
        root.setLevel(level)


class _StdlibLoggerAdapter:
    """
    Thin wrapper around stdlib Logger that accepts structlog-style keyword
    arguments (e.g. event=, session_id=) and formats them into the message.
    """

    def __init__(self, logger: logging.Logger):
        self._logger = logger

    def _format(self, msg: str, args: tuple, kwargs: dict) -> str:
        # Apply %-style positional formatting if args are provided
        if args:
            try:
                msg = msg % args
            except (TypeError, ValueError):
                pass
        if kwargs:
            extra = " ".join(f"{k}={v!r}" for k, v in kwargs.items())
            return f"{msg} {extra}"
        return msg

    def debug(self, msg: str, *args, **kwargs):
        self._logger.debug(self._format(msg, args, kwargs))

    def info(self, msg: str, *args, **kwargs):
        self._logger.info(self._format(msg, args, kwargs))

    def warning(self, msg: str, *args, **kwargs):
        self._logger.warning(self._format(msg, args, kwargs))

    def error(self, msg: str, *args, **kwargs):
        self._logger.error(self._format(msg, args, kwargs))

    def critical(self, msg: str, *args, **kwargs):
        self._logger.critical(self._format(msg, args, kwargs))


def get_logger(name: str):
    """
    Return a structured logger for the given module name.

    Uses structlog if available, otherwise returns a stdlib logger adapter
    that accepts keyword arguments in structlog style.

    Args:
        name: Logger name (typically __name__).

    Returns:
        A structlog BoundLogger or _StdlibLoggerAdapter.
    """
    if _STRUCTLOG_AVAILABLE:
        return structlog.get_logger(name)
    return _StdlibLoggerAdapter(logging.getLogger(name))


def log_detection_event(
    logger,
    *,
    session_id: str,
    user_hash: str,
    risk_score: float,
    decision: str,
    correlation_id: Optional[str] = None,
    extra: Optional[dict] = None,
) -> None:
    """
    Log a detection event with standardized fields.

    Wallet addresses are NEVER logged — only the anonymized user_hash.

    Args:
        logger: Logger instance (structlog or stdlib).
        session_id: Session identifier.
        user_hash: SHA-256 hashed wallet address (anonymized).
        risk_score: Calculated risk score (0–100).
        decision: Detection decision ('allow', 'challenge', 'block').
        correlation_id: Optional correlation ID for distributed tracing.
        extra: Additional key-value pairs to include in the log entry.
    """
    cid = correlation_id or get_correlation_id()

    severity = _decision_to_severity(decision)
    fields = {
        "event": "detection_result",
        "session_id": session_id,
        "user_hash": user_hash,
        "risk_score": round(risk_score, 2),
        "decision": decision,
        "correlation_id": cid,
        **(extra or {}),
    }

    if _STRUCTLOG_AVAILABLE:
        log_fn = getattr(logger, severity, logger.info)
        log_fn("detection_result", **fields)
    else:
        log_fn = getattr(logger, severity, logger.info)
        # Format as message with extra fields for JSON formatter compatibility
        import json
        log_fn(json.dumps(fields))

def _decision_to_severity(decision: str) -> str:
    """Map a detection decision to a log severity level."""
    mapping = {
        "allow": "info",
        "challenge": "warning",
        "block": "error",
    }
    return mapping.get(decision, "info")
