"""Rexell AI Insights service.

Provides AI components for the Rexell ticketing domain:

- ``forecast`` — an LSTM-based resale-price / demand forecaster trained on
  Rexell transaction history.
- ``rag`` — a retrieval-augmented assistant answering questions about Rexell
  events, tickets and resale policy.

The service is intentionally dependency-light: heavy ML libraries
(TensorFlow, sentence-transformers, langchain) are imported lazily so the
service always boots and degrades to deterministic heuristics when a model
or library is unavailable.
"""

__version__ = "0.1.0"
