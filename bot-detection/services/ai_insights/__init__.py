"""Rexell AI Insights service.

Adapts the AI components from the CryptoAI reference project to the Rexell
ticketing domain:

- ``forecast`` — an LSTM-based resale-price / demand forecaster trained on
  Rexell transaction history (replaces CryptoAI's Binance/ccxt crypto model).
- ``rag`` — a retrieval-augmented assistant answering questions about Rexell
  events, tickets and resale policy (replaces CryptoAI's Wikipedia RAG).

The service is intentionally dependency-light: heavy ML libraries
(TensorFlow, sentence-transformers, langchain) are imported lazily so the
service always boots and degrades to deterministic heuristics when a model
or library is unavailable.
"""

__version__ = "0.1.0"
