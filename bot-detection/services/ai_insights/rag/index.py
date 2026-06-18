"""Document index / retriever for the Rexell assistant.

Loads Rexell knowledge (repo markdown docs + any injected event context),
splits it into overlapping chunks and retrieves the most relevant chunks for a
query. Uses sentence-transformer embeddings + cosine similarity when available
and transparently falls back to keyword-overlap scoring otherwise, so the
assistant works with zero heavy dependencies.

This provides a lightweight, offline-friendly retriever pointed at Rexell
content.
"""

import re
from pathlib import Path
from typing import List, Optional, Tuple

from ..config import settings
from ..logger import get_logger

logger = get_logger(__name__)

# Curated set of Rexell knowledge documents (relative to RAG_DOCS_DIR).
_DOC_FILES = [
    "README.md",
    "FUNCTIONAL_REQUIREMENTS.md",
    "RESALE_IMPLEMENTATION.md",
    "RESALE_ROYALTY_HISTORY.md",
    "TESTING_GUIDE.md",
    "TECH_STACK.md",
    "Bot_detection.md",
    "PROJECT_PLAN.md",
]

_CHUNK_SIZE = 700
_CHUNK_OVERLAP = 150
_STOPWORDS = {
    "the", "a", "an", "is", "are", "of", "to", "and", "in", "on", "for", "with",
    "how", "what", "why", "when", "do", "does", "can", "i", "you", "it", "this",
    "that", "be", "as", "at", "by", "or", "from", "my",
}


def _tokenize(text: str) -> List[str]:
    return [t for t in re.findall(r"[a-z0-9]+", text.lower()) if t not in _STOPWORDS]


def _clean_markdown(text: str) -> str:
    """Strip non-prose noise (code/mermaid fences, tables, headings markup)
    so retrieval and extractive answers stay readable."""
    text = re.sub(r"```.*?```", " ", text, flags=re.DOTALL)  # fenced code / mermaid
    text = re.sub(r"`([^`]*)`", r"\1", text)  # inline code
    lines = []
    for line in text.splitlines():
        stripped = line.strip()
        if stripped.startswith("|"):  # markdown table rows
            continue
        if set(stripped) <= {"-", "|", ":", " "} and stripped:  # table separators / rules
            continue
        stripped = re.sub(r"^#{1,6}\s*", "", stripped)  # heading markers
        stripped = re.sub(r"[*_>]+", "", stripped)  # emphasis / blockquote
        lines.append(stripped)
    text = "\n".join(lines)
    text = re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", text)  # markdown links -> text
    text = re.sub(r"[ \t]{2,}", " ", text)
    return text


class DocumentIndex:
    def __init__(self) -> None:
        self.chunks: List[str] = []
        self.sources: List[str] = []
        self.vector_store = None  # LangChain FAISS instance when available
        self._embeddings = None  # legacy numpy array when embedding backend available
        self._embedder = None

    # ------------------------------------------------------------------
    def build(self, extra_docs: Optional[List[Tuple[str, str]]] = None) -> None:
        """Load docs, chunk them, and (optionally) compute embeddings."""
        docs_dir = settings.RAG_DOCS_DIR
        loaded = 0
        for name in _DOC_FILES:
            path = docs_dir / name
            try:
                text = path.read_text(encoding="utf-8", errors="ignore")
            except FileNotFoundError:
                continue
            for chunk in self._split(text):
                self.chunks.append(chunk)
                self.sources.append(name)
            loaded += 1

        for source, text in extra_docs or []:
            for chunk in self._split(text):
                self.chunks.append(chunk)
                self.sources.append(source)

        logger.info("Built document index", evt="rag_index_built", docs=loaded, chunks=len(self.chunks))
        self._try_embed()

    def _split(self, text: str) -> List[str]:
        text = _clean_markdown(text)
        text = re.sub(r"\n{3,}", "\n\n", text).strip()
        if not text:
            return []
        chunks = []
        start = 0
        while start < len(text):
            end = start + _CHUNK_SIZE
            chunks.append(text[start:end])
            start = end - _CHUNK_OVERLAP
        return chunks

    def _try_embed(self) -> None:
        if not self.chunks:
            return

        # 1. Try LangChain + FAISS + HuggingFaceEmbeddings first
        try:
            from langchain_community.embeddings import HuggingFaceEmbeddings  # type: ignore
            from langchain_community.vectorstores import FAISS  # type: ignore
            from langchain_core.documents import Document  # type: ignore

            documents = [
                Document(page_content=chunk, metadata={"source": source})
                for chunk, source in zip(self.chunks, self.sources)
            ]
            embeddings = HuggingFaceEmbeddings(model_name=settings.RAG_EMBED_MODEL)
            self.vector_store = FAISS.from_documents(documents, embeddings)
            logger.info("Computed RAG embeddings using LangChain + FAISS", evt="rag_langchain_embeddings_ready")
            return
        except Exception as exc:  # noqa: BLE001
            logger.warning("LangChain + FAISS vector store unavailable, trying legacy dense embeddings", evt="rag_langchain_fallback", error=str(exc))
            self.vector_store = None

        # 2. Try legacy sentence_transformers fallback
        try:
            # pyrefly: ignore [missing-import]
            from sentence_transformers import SentenceTransformer  # lazy, heavy
            import numpy as np

            self._embedder = SentenceTransformer(settings.RAG_EMBED_MODEL)
            self._embeddings = np.asarray(
                self._embedder.encode(self.chunks, normalize_embeddings=True),
                dtype="float32",
            )
            logger.info("Computed RAG embeddings using legacy backend", evt="rag_embeddings_ready", dim=self._embeddings.shape[1])
        except Exception as exc:  # noqa: BLE001
            logger.warning("Embedding backend unavailable; keyword retrieval active", evt="rag_embed_fallback", error=str(exc))
            self._embedder = None
            self._embeddings = None

    # ------------------------------------------------------------------
    def retrieve(self, query: str, k: int = 4) -> List[Tuple[str, str, float]]:
        """Return up to ``k`` (chunk, source, score) tuples for the query."""
        if not self.chunks:
            return []

        # Use LangChain FAISS retrieval if available
        if self.vector_store is not None:
            try:
                # FAISS similarity search returns Tuple[Document, float] (where float is distance or relevance score)
                docs_and_scores = self.vector_store.similarity_search_with_relevance_scores(query, k=k)
                results = []
                for doc, score in docs_and_scores:
                    source = doc.metadata.get("source", "unknown")
                    # If score is below 0, replace with 0.0
                    results.append((doc.page_content, source, max(0.0, float(score))))
                return results
            except Exception as exc:  # noqa: BLE001
                logger.warning("LangChain similarity search failed, falling back to legacy/keyword retrieval", evt="rag_langchain_retrieve_failed", error=str(exc))

        if self._embedder is not None and self._embeddings is not None:
            return self._retrieve_dense(query, k)
        return self._retrieve_keyword(query, k)

    def _retrieve_dense(self, query: str, k: int):
        import numpy as np

        q = np.asarray(self._embedder.encode([query], normalize_embeddings=True), dtype="float32")[0]
        scores = self._embeddings @ q
        top = np.argsort(scores)[::-1][:k]
        return [(self.chunks[i], self.sources[i], float(scores[i])) for i in top]

    def _retrieve_keyword(self, query: str, k: int):
        q_tokens = set(_tokenize(query))
        if not q_tokens:
            return []
        scored = []
        for chunk, source in zip(self.chunks, self.sources):
            c_tokens = _tokenize(chunk)
            if not c_tokens:
                continue
            overlap = sum(1 for t in c_tokens if t in q_tokens)
            score = overlap / (len(q_tokens) ** 0.5)
            if score > 0:
                scored.append((chunk, source, score))
        scored.sort(key=lambda x: x[2], reverse=True)
        return scored[:k]

    @property
    def backend(self) -> str:
        if self.vector_store is not None:
            return "langchain_faiss"
        return "embeddings" if self._embeddings is not None else "keyword"
