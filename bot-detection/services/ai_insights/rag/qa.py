"""Question-answering engine for the Rexell assistant.

Retrieves relevant Rexell knowledge (see ``index.py``) and produces an answer.
When ``HUGGINGFACEHUB_API_TOKEN`` is configured the retrieved context is sent
to a hosted LLM (Mistral-7B-Instruct by default) via the
HuggingFace Inference API. Otherwise it returns a concise extractive answer
built from the top retrieved chunks, so the assistant is always useful.
"""

import re
from typing import List, Optional, Tuple

from ..config import settings
from ..logger import get_logger
from .index import DocumentIndex

logger = get_logger(__name__)

_PROMPT_TEMPLATE = (
    "You are the Rexell ticketing assistant. Answer the question using only the "
    "context below, which describes the Rexell decentralized ticketing platform "
    "(events, NFT tickets, cUSD payments on Celo, resale rules and bot "
    "detection). Give a direct, concise answer. If the context does not contain "
    "the answer, say you don't have that information.\n\n"
    "Context:\n{context}\n\nQuestion: {question}\n\nAnswer:"
)


def _get_active_ollama_model() -> Optional[str]:
    """Check Ollama local API to see if the requested model is available,
    falling back dynamically to other pulled models if needed."""
    try:
        import httpx
        resp = httpx.get(f"{settings.OLLAMA_BASE_URL.rstrip('/')}/api/tags", timeout=2.0)
        if resp.status_code == 200:
            models_info = resp.json().get("models", [])
            pulled_names = {m["name"] for m in models_info}
            # 1. Prefer the configured model if pulled
            target = settings.OLLAMA_MODEL
            if target in pulled_names:
                return target
            if f"{target}:latest" in pulled_names:
                return f"{target}:latest"
            
            # 2. Dynamic fallbacks among already pulled models
            fallbacks = ["qwen2.5-coder:7b", "llama3.2:1b", "aya:8b"]
            for f in fallbacks:
                if f in pulled_names:
                    logger.info("Ollama target model not fully pulled yet, falling back", evt="ollama_model_fallback", target=target, chosen=f)
                    return f
            
            # 3. If any model is pulled, use the first one
            if models_info:
                chosen = models_info[0]["name"]
                logger.info("Using first available Ollama model", evt="ollama_first_model", chosen=chosen)
                return chosen
    except Exception as exc:  # noqa: BLE001
        logger.warning("Failed to query Ollama local API tags for fallback checks", evt="ollama_tags_query_failed", error=str(exc))
    return settings.OLLAMA_MODEL


class RAGEngine:
    def __init__(self) -> None:
        self.index = DocumentIndex()
        self._ready = False

    def load(self) -> None:
        self.index.build()
        self._ready = True

    def ask(self, question: str) -> dict:
        question = (question or "").strip()
        if not question:
            return {"answer": "Please ask a question about Rexell events, tickets or resale.", "sources": [], "mode": "empty"}

        hits = self.index.retrieve(question, k=4)
        if not hits:
            return {
                "answer": "I don't have information on that yet. Try asking about events, ticket purchases, resale rules or bot detection.",
                "sources": [],
                "mode": "no_context",
            }

        context = "\n\n".join(h[0] for h in hits)
        sources = sorted({h[1] for h in hits})

        llm_answer = self._llm_answer(question, context)
        if llm_answer:
            return {"answer": llm_answer, "sources": sources, "mode": "llm", "retriever": self.index.backend}

        return {
            "answer": self._extractive_answer(question, hits),
            "sources": sources,
            "mode": "extractive",
            "retriever": self.index.backend,
        }

    # ------------------------------------------------------------------
    def _llm_answer(self, question: str, context: str) -> Optional[str]:
        # 1. Try local Ollama via LangChain first
        try:
            from langchain_ollama import OllamaLLM

            # Check if target model is ready, or use a dynamic fallback if download is in progress
            active_model = _get_active_ollama_model()
            prompt = _PROMPT_TEMPLATE.format(context=context[:4000], question=question)
            
            # Initialize local Ollama model
            llm = OllamaLLM(
                base_url=settings.OLLAMA_BASE_URL,
                model=active_model,
                timeout=30.0,
            )
            response = llm.invoke(prompt)
            if response and response.strip():
                logger.info("Answered query using local Ollama", evt="rag_ollama_success", model=active_model)
                return response.strip()
        except Exception as exc:  # noqa: BLE001
            logger.warning("Local Ollama query failed; trying HuggingFace / extractive fallbacks", evt="rag_ollama_failed", error=str(exc))

        # 2. Try Hugging Face Inference API as fallback
        token = settings.HUGGINGFACEHUB_API_TOKEN
        if not token:
            return None
        prompt = _PROMPT_TEMPLATE.format(context=context[:4000], question=question)
        try:
            import httpx

            url = f"https://api-inference.huggingface.co/models/{settings.RAG_LLM_REPO_ID}"
            resp = httpx.post(
                url,
                headers={"Authorization": f"Bearer {token}"},
                json={
                    "inputs": prompt,
                    "parameters": {"temperature": 0.5, "max_new_tokens": 256, "return_full_text": False},
                },
                timeout=30.0,
            )
            resp.raise_for_status()
            data = resp.json()
            if isinstance(data, list) and data and "generated_text" in data[0]:
                return data[0]["generated_text"].strip()
            if isinstance(data, dict) and "generated_text" in data:
                return data["generated_text"].strip()
            logger.warning("Unexpected LLM response shape", evt="rag_llm_shape")
            return None
        except Exception as exc:  # noqa: BLE001
            logger.warning("LLM call failed; using extractive answer", evt="rag_llm_error", error=str(exc))
            return None

    def _extractive_answer(self, question: str, hits: List[Tuple[str, str, float]]) -> str:
        """Pick the most relevant sentences from the top chunks."""
        from .index import _tokenize

        q_tokens = set(_tokenize(question))
        best_sentences: List[Tuple[float, str]] = []
        for chunk, _src, _score in hits[:3]:
            for sentence in re.split(r"(?<=[.!?])\s+", chunk):
                sentence = sentence.strip()
                if len(sentence) < 25:
                    continue
                s_tokens = _tokenize(sentence)
                if not s_tokens:
                    continue
                overlap = sum(1 for t in s_tokens if t in q_tokens)
                if overlap:
                    best_sentences.append((overlap / (len(s_tokens) ** 0.5), sentence))
        best_sentences.sort(key=lambda x: x[0], reverse=True)
        if not best_sentences:
            return hits[0][0][:400].strip()
        chosen: List[str] = []
        seen: set = set()
        for _score, sentence in best_sentences:
            key = re.sub(r"\W+", "", sentence.lower())
            if key in seen:
                continue
            seen.add(key)
            chosen.append(sentence)
            if len(chosen) >= 3:
                break
        return " ".join(chosen)

    @property
    def status(self) -> dict:
        return {"ready": self._ready, "retriever": self.index.backend, "chunks": len(self.index.chunks)}
