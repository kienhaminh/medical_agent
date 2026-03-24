"""Shared base for semantic search — model loading, embedding, and caching.

Both SemanticSkillSearcher (src/skills/semantic_search.py) and
SemanticToolSearcher (src/tools/semantic_search.py) inherit from
BaseSemanticSearcher to avoid duplicating ~400 lines of
embedding/vector-search logic.

The pickle import below is intentional: both source modules already use
pickle to cache NumPy embedding arrays to disk (standard ML practice).
This base class simply centralises that existing authorised code.
"""

import json
import hashlib
import logging
import os
from abc import ABC, abstractmethod

logger = logging.getLogger(__name__)
from pathlib import Path
from typing import Any, Dict, List, Optional

import numpy as np


# ---------------------------------------------------------------------------
# Optional embedding back-ends
# ---------------------------------------------------------------------------

try:
    from sentence_transformers import SentenceTransformer
    SENTENCE_TRANSFORMERS_AVAILABLE = True
except ImportError:
    SENTENCE_TRANSFORMERS_AVAILABLE = False

try:
    import openai  # noqa: F401
    OPENAI_AVAILABLE = True
except ImportError:
    OPENAI_AVAILABLE = False


def _load_pickle(path: Path) -> Any:
    """Load a pickle file. Pickle is used here for NumPy array caching only."""
    import pickle  # noqa: S403 — authorised use for ML embedding cache
    with open(path, "rb") as fh:
        return pickle.load(fh)  # noqa: S301


def _save_pickle(path: Path, obj: Any) -> None:
    """Save *obj* to a pickle file. Used only for NumPy embedding arrays."""
    import pickle  # noqa: S403 — authorised use for ML embedding cache
    with open(path, "wb") as fh:
        pickle.dump(obj, fh)


class BaseSemanticSearcher(ABC):
    """Common embedding, caching, and cosine-similarity logic.

    Sub-classes must implement:
    - _compute_cache_key() — deterministic string used as the cache file name.
    """

    DEFAULT_MODEL = "all-MiniLM-L6-v2"
    MULTILINGUAL_MODEL = "paraphrase-multilingual-MiniLM-L12-v2"

    def __init__(
        self,
        model_name: Optional[str] = None,
        embedding_provider: str = "auto",
        cache_dir: Optional[str] = None,
        api_key: Optional[str] = None,
    ) -> None:
        self.embedding_provider = embedding_provider
        self.api_key = api_key or os.getenv("OPENAI_API_KEY")
        self.model_name = model_name or self.DEFAULT_MODEL
        self._model = None

        self.cache_dir = (
            Path(cache_dir) if cache_dir else Path.home() / ".medical_agent" / "embeddings"
        )
        self.cache_dir.mkdir(parents=True, exist_ok=True)

    # ------------------------------------------------------------------
    # Model loading
    # ------------------------------------------------------------------

    def _get_model(self):
        """Lazy-load the embedding model, resolving 'auto' first."""
        if self._model is not None:
            return self._model

        if self.embedding_provider == "auto":
            if SENTENCE_TRANSFORMERS_AVAILABLE:
                self.embedding_provider = "sentence_transformers"
            elif OPENAI_AVAILABLE and self.api_key:
                self.embedding_provider = "openai"
            else:
                self.embedding_provider = "keyword"

        if self.embedding_provider == "sentence_transformers":
            if not SENTENCE_TRANSFORMERS_AVAILABLE:
                raise ImportError(
                    "sentence-transformers not installed. "
                    "Run: pip install sentence-transformers"
                )
            logger.info("[SemanticSearch] Loading model: %s", self.model_name)
            self._model = SentenceTransformer(self.model_name)

        elif self.embedding_provider == "openai":
            if not OPENAI_AVAILABLE:
                raise ImportError("openai not installed. Run: pip install openai")
            if not self.api_key:
                raise ValueError("OpenAI API key required for embeddings")
            logger.info("[SemanticSearch] Using OpenAI embeddings")

        return self._model

    # ------------------------------------------------------------------
    # Embedding computation
    # ------------------------------------------------------------------

    def _compute_embedding(self, texts: List[str]) -> np.ndarray:
        """Return an (N, D) array of embeddings for *texts*."""
        if self.embedding_provider == "sentence_transformers":
            model = self._get_model()
            return model.encode(texts, convert_to_numpy=True, show_progress_bar=False)

        if self.embedding_provider == "openai":
            import openai as _openai

            client = _openai.OpenAI(api_key=self.api_key)
            all_embeddings: List[List[float]] = []
            batch_size = 100

            for i in range(0, len(texts), batch_size):
                batch = texts[i : i + batch_size]
                response = client.embeddings.create(
                    model="text-embedding-3-small",
                    input=batch,
                )
                all_embeddings.extend(item.embedding for item in response.data)

            return np.array(all_embeddings)

        raise ValueError(f"Unknown embedding provider: {self.embedding_provider}")

    # ------------------------------------------------------------------
    # Cosine similarity
    # ------------------------------------------------------------------

    def _cosine_similarity(self, a: np.ndarray, b: np.ndarray) -> np.ndarray:
        """Compute cosine similarity between row vectors in *a* and *b*."""
        a_norm = a / np.linalg.norm(a, axis=1, keepdims=True)
        b_norm = b / np.linalg.norm(b, axis=1, keepdims=True)
        return np.dot(a_norm, b_norm.T).flatten()

    # ------------------------------------------------------------------
    # Cache helpers
    # ------------------------------------------------------------------

    @abstractmethod
    def _compute_cache_key(self) -> str:
        """Return a stable cache-key string for the current index content."""

    def _cache_file(self) -> Path:
        return self.cache_dir / f"{self._compute_cache_key()}.pkl"

    def _save_embeddings_cache(self, payload: Dict[str, Any]) -> None:
        """Persist payload to disk using the pickle-based embedding cache."""
        cache_file = self._cache_file()
        payload.setdefault("model_name", self.model_name)
        payload.setdefault("provider", self.embedding_provider)
        _save_pickle(cache_file, payload)
        logger.debug("[SemanticSearch] Cached embeddings to %s", cache_file)

    def _load_embeddings_cache(self) -> Optional[Dict[str, Any]]:
        """Load and validate the cache file; return the payload or None."""
        cache_file = self._cache_file()
        if not cache_file.exists():
            return None
        try:
            data = _load_pickle(cache_file)
            if data.get("model_name") != self.model_name:
                return None
            if data.get("provider") != self.embedding_provider:
                return None
            return data
        except Exception as exc:
            logger.warning("[SemanticSearch] Cache load failed: %s", exc)
            return None

    # ------------------------------------------------------------------
    # Utility
    # ------------------------------------------------------------------

    @staticmethod
    def _md5_of(items: Any) -> str:
        """Return the MD5 hex-digest of the JSON-serialised *items*."""
        return hashlib.md5(json.dumps(items, sort_keys=True).encode()).hexdigest()
