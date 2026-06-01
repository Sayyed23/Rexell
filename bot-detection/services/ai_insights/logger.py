"""Lightweight structured logging for the AI Insights service.

Mirrors the JSON/correlation-id style of the detection service but keeps the
dependency surface minimal (structlog is optional).
"""

import logging
import sys
import uuid
from contextvars import ContextVar
from typing import Optional

try:
    import structlog

    _STRUCTLOG_AVAILABLE = True
except ImportError:  # pragma: no cover
    _STRUCTLOG_AVAILABLE = False

_correlation_id_var: ContextVar[str] = ContextVar("correlation_id", default="")


def get_correlation_id() -> str:
    return _correlation_id_var.get("")


def set_correlation_id(correlation_id: Optional[str] = None) -> str:
    cid = correlation_id or str(uuid.uuid4())
    _correlation_id_var.set(cid)
    return cid


def _add_correlation_id(logger, method_name, event_dict):  # noqa: ARG001
    cid = get_correlation_id()
    if cid:
        event_dict["correlation_id"] = cid
    return event_dict


def configure_logging(log_level: str = "INFO") -> None:
    level = getattr(logging, log_level.upper(), logging.INFO)
    if _STRUCTLOG_AVAILABLE:
        structlog.configure(
            processors=[
                structlog.contextvars.merge_contextvars,
                structlog.stdlib.add_log_level,
                structlog.processors.TimeStamper(fmt="iso"),
                _add_correlation_id,
                structlog.processors.format_exc_info,
                structlog.processors.JSONRenderer(),
            ],
            wrapper_class=structlog.make_filtering_bound_logger(level),
            context_class=dict,
            logger_factory=structlog.PrintLoggerFactory(sys.stdout),
            cache_logger_on_first_use=True,
        )
    else:
        handler = logging.StreamHandler(sys.stdout)
        handler.setFormatter(
            logging.Formatter(
                '{"name":"%(name)s","level":"%(levelname)s","message":"%(message)s"}'
            )
        )
        root = logging.getLogger()
        root.handlers.clear()
        root.addHandler(handler)
        root.setLevel(level)


class _StdlibAdapter:
    def __init__(self, logger: logging.Logger):
        self._logger = logger

    def _format(self, msg: str, kwargs: dict) -> str:
        if kwargs:
            extra = " ".join(f"{k}={v!r}" for k, v in kwargs.items())
            return f"{msg} {extra}"
        return msg

    def debug(self, msg, **kw):
        self._logger.debug(self._format(msg, kw))

    def info(self, msg, **kw):
        self._logger.info(self._format(msg, kw))

    def warning(self, msg, **kw):
        self._logger.warning(self._format(msg, kw))

    def error(self, msg, **kw):
        self._logger.error(self._format(msg, kw))


def get_logger(name: str):
    if _STRUCTLOG_AVAILABLE:
        return structlog.get_logger(name)
    return _StdlibAdapter(logging.getLogger(name))
