"""Semantic Tool Search - Vector-based tool discovery.

Uses embeddings to find semantically similar tools based on meaning,
not just keywords. Much more accurate than keyword matching.

Usage:
    >>> from src.tools.semantic_search import SemanticToolSearcher
    >>> searcher = SemanticToolSearcher()
    >>> searcher.index_tools()  # One-time indexing
    >>> results = searcher.search("làm thế nào để tìm thông tin bệnh nhân")
    # Returns tools about patient lookup even though query is in Vietnamese
"""

import json
import re
import os
import hashlib
import pickle
from pathlib import Path
from typing import List, Dict, Any, Optional, Tuple
from dataclasses import dataclass
from inspect import signature, Parameter
import numpy as np

from .pool import ToolPool


# Try to import embedding libraries
try:
    from sentence_transformers import SentenceTransformer
    SENTENCE_TRANSFORMERS_AVAILABLE = True
except ImportError:
    SENTENCE_TRANSFORMERS_AVAILABLE = False

try:
    import openai
    OPENAI_AVAILABLE = True
except ImportError:
    OPENAI_AVAILABLE = False


@dataclass
class SemanticToolResult:
    """Result from semantic tool search."""
    name: str
    description: str
    parameters: Dict[str, Any]
    skill: str
    similarity_score: float
    matched_keywords: List[str]


class SemanticToolSearcher:
    """Semantic tool search using embeddings.
    
    Features:
    - Vector similarity search for tool discovery
    - Multi-language support (queries in any language)
    - Caching for fast repeated searches
    - Fallback to keyword matching if embeddings unavailable
    
    Usage:
        >>> searcher = SemanticToolSearcher()
        >>> searcher.index_tools()  # Build index once
        >>> 
        >>> # Search in any language
        >>> results = searcher.search("how to find patient info", top_k=3)
        >>> results = searcher.search("cách tìm thông tin bệnh nhân", top_k=3)  # Same results!
    """
    
    # Default embedding model (lightweight, good for English + multilingual)
    DEFAULT_MODEL = "all-MiniLM-L6-v2"  # 22MB, fast, good quality
    ALTERNATIVE_MODEL = "paraphrase-multilingual-MiniLM-L12-v2"  # Better for non-English
    
    def __init__(
        self,
        tool_pool: Optional[ToolPool] = None,
        model_name: Optional[str] = None,
        embedding_provider: str = "auto",  # auto, sentence_transformers, openai, keyword
        cache_dir: Optional[str] = None,
        api_key: Optional[str] = None
    ):
        """Initialize semantic tool searcher.
        
        Args:
            tool_pool: ToolPool instance
            model_name: Sentence transformer model name
            embedding_provider: Which embedding provider to use
            cache_dir: Directory to cache embeddings
            api_key: OpenAI API key (if using OpenAI embeddings)
        """
        self.pool = tool_pool or ToolPool()
        self.embedding_provider = embedding_provider
        self.api_key = api_key or os.getenv("OPENAI_API_KEY")
        
        # Embedding model
        self.model_name = model_name or self.DEFAULT_MODEL
        self._model = None
        
        # Cache
        self.cache_dir = Path(cache_dir) if cache_dir else Path.home() / ".medical_agent" / "embeddings"
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        
        # Indexed data
        self._indexed = False
        self._tool_names: List[str] = []
        self._tool_texts: List[str] = []
        self._tool_embeddings: Optional[np.ndarray] = None
        self._tool_info: Dict[str, Any] = {}
    
    def _get_model(self):
        """Lazy load embedding model."""
        if self._model is not None:
            return self._model
        
        if self.embedding_provider == "auto":
            # Try sentence transformers first
            if SENTENCE_TRANSFORMERS_AVAILABLE:
                self.embedding_provider = "sentence_transformers"
            elif OPENAI_AVAILABLE and self.api_key:
                self.embedding_provider = "openai"
            else:
                self.embedding_provider = "keyword"
        
        if self.embedding_provider == "sentence_transformers":
            if not SENTENCE_TRANSFORMERS_AVAILABLE:
                raise ImportError("sentence-transformers not installed. Run: pip install sentence-transformers")
            print(f"[SemanticSearch] Loading model: {self.model_name}")
            self._model = SentenceTransformer(self.model_name)
            
        elif self.embedding_provider == "openai":
            if not OPENAI_AVAILABLE:
                raise ImportError("openai not installed. Run: pip install openai")
            if not self.api_key:
                raise ValueError("OpenAI API key required for embeddings")
            print("[SemanticSearch] Using OpenAI embeddings")
            
        return self._model
    
    def _compute_embedding(self, texts: List[str]) -> np.ndarray:
        """Compute embeddings for texts."""
        if self.embedding_provider == "sentence_transformers":
            model = self._get_model()
            return model.encode(texts, convert_to_numpy=True, show_progress_bar=False)
        
        elif self.embedding_provider == "openai":
            import openai
            client = openai.OpenAI(api_key=self.api_key)
            
            # OpenAI has rate limits, process in batches
            all_embeddings = []
            batch_size = 100
            
            for i in range(0, len(texts), batch_size):
                batch = texts[i:i + batch_size]
                response = client.embeddings.create(
                    model="text-embedding-3-small",
                    input=batch
                )
                batch_embeddings = [item.embedding for item in response.data]
                all_embeddings.extend(batch_embeddings)
            
            return np.array(all_embeddings)
        
        else:
            raise ValueError(f"Unknown embedding provider: {self.embedding_provider}")
    
    def _compute_cache_key(self) -> str:
        """Compute cache key based on current tools."""
        tools = self.pool.list_tools()
        tools_str = json.dumps(tools, sort_keys=True)
        return hashlib.md5(tools_str.encode()).hexdigest()
    
    def _save_cache(self):
        """Save embeddings to cache."""
        cache_key = self._compute_cache_key()
        cache_file = self.cache_dir / f"{cache_key}.pkl"
        
        data = {
            "tool_names": self._tool_names,
            "tool_texts": self._tool_texts,
            "tool_embeddings": self._tool_embeddings,
            "tool_info": self._tool_info,
            "model_name": self.model_name,
            "provider": self.embedding_provider
        }
        
        with open(cache_file, "wb") as f:
            pickle.dump(data, f)
        
        print(f"[SemanticSearch] Cached embeddings to {cache_file}")
    
    def _load_cache(self) -> bool:
        """Load embeddings from cache if available."""
        cache_key = self._compute_cache_key()
        cache_file = self.cache_dir / f"{cache_key}.pkl"
        
        if not cache_file.exists():
            return False
        
        try:
            with open(cache_file, "rb") as f:
                data = pickle.load(f)
            
            # Verify cache is compatible
            if data.get("model_name") != self.model_name:
                return False
            if data.get("provider") != self.embedding_provider:
                return False
            
            self._tool_names = data["tool_names"]
            self._tool_texts = data["tool_texts"]
            self._tool_embeddings = data["tool_embeddings"]
            self._tool_info = data["tool_info"]
            self._indexed = True
            
            print(f"[SemanticSearch] Loaded {len(self._tool_names)} tools from cache")
            return True
            
        except Exception as e:
            print(f"[SemanticSearch] Cache load failed: {e}")
            return False
    
    def _create_tool_text(self, name: str, description: str, skill: str) -> str:
        """Create rich text representation of tool for embedding."""
        # Combine multiple fields for better semantic matching
        parts = [name.replace("_", " ")]
        
        if description:
            # Extract first paragraph (most important)
            first_para = description.split("\n\n")[0]
            parts.append(first_para)
        
        parts.append(f"skill: {skill}")
        
        return " | ".join(parts)
    
    def index_tools(self, force_reindex: bool = False) -> int:
        """Build semantic index of all tools.
        
        Args:
            force_reindex: Force rebuild even if cache exists
            
        Returns:
            Number of tools indexed
        """
        # Try cache first
        if not force_reindex and self._load_cache():
            return len(self._tool_names)
        
        # Get all tools
        all_tools = self.pool.list_tools()
        
        if not all_tools:
            print("[SemanticSearch] No tools to index")
            return 0
        
        # Prepare texts for embedding
        self._tool_names = []
        self._tool_texts = []
        self._tool_info = {}
        
        for tool_data in all_tools:
            name = tool_data["name"]
            full_info = self.pool.get_info(name)
            
            if not full_info:
                continue
            
            # Create rich text
            text = self._create_tool_text(
                name=name,
                description=full_info.description or "",
                skill=full_info.skill_name
            )
            
            self._tool_names.append(name)
            self._tool_texts.append(text)
            self._tool_info[name] = full_info
        
        if not self._tool_texts:
            print("[SemanticSearch] No valid tools to index")
            return 0
        
        # Compute embeddings
        print(f"[SemanticSearch] Indexing {len(self._tool_texts)} tools...")
        self._tool_embeddings = self._compute_embedding(self._tool_texts)
        self._indexed = True
        
        # Save to cache
        self._save_cache()
        
        return len(self._tool_names)
    
    def _cosine_similarity(self, a: np.ndarray, b: np.ndarray) -> np.ndarray:
        """Compute cosine similarity between vectors."""
        # Normalize vectors
        a_norm = a / np.linalg.norm(a, axis=1, keepdims=True)
        b_norm = b / np.linalg.norm(b, axis=1, keepdims=True)
        # Compute similarity
        return np.dot(a_norm, b_norm.T).flatten()
    
    def search(
        self,
        query: str,
        top_k: int = 5,
        min_score: float = 0.3,
        include_params: bool = True,
        format_for_llm: bool = True
    ) -> str:
        """Semantic search for tools.
        
        Args:
            query: Natural language query (any language supported)
            top_k: Number of results to return
            min_score: Minimum similarity score (0-1)
            include_params: Include parameter info
            format_for_llm: Format for LLM consumption
            
        Returns:
            Formatted search results
        """
        # Ensure indexed
        if not self._indexed:
            self.index_tools()
        
        if not self._tool_names:
            return "No tools available."
        
        # Check if we should use semantic search or fallback
        if self.embedding_provider == "keyword" or self._tool_embeddings is None:
            return self._keyword_search(query, top_k, include_params, format_for_llm)
        
        # Compute query embedding
        query_embedding = self._compute_embedding([query])
        
        # Compute similarities
        similarities = self._cosine_similarity(query_embedding, self._tool_embeddings)
        
        # Get top-k results
        top_indices = np.argsort(similarities)[::-1][:top_k]
        
        results = []
        for idx in top_indices:
            score = float(similarities[idx])
            if score < min_score:
                continue
            
            name = self._tool_names[idx]
            tool_info = self._tool_info[name]
            
            # Extract keywords that matched
            matched_keywords = self._extract_keywords(query, name, tool_info.description or "")
            
            # Get parameters
            parameters = self._extract_parameters(tool_info.func) if include_params else {}
            
            result = SemanticToolResult(
                name=name,
                description=tool_info.description or "No description",
                parameters=parameters,
                skill=tool_info.skill_name,
                similarity_score=score,
                matched_keywords=matched_keywords
            )
            results.append(result)
        
        if format_for_llm:
            return self._format_for_llm(results)
        else:
            return json.dumps([self._result_to_dict(r) for r in results], indent=2)
    
    def _keyword_search(
        self,
        query: str,
        top_k: int = 5,
        include_params: bool = True,
        format_for_llm: bool = True
    ) -> str:
        """Fallback keyword-based search."""
        from .search import ToolSearcher
        
        # Use original keyword searcher
        searcher = ToolSearcher(self.pool)
        return searcher.search(query, top_k, include_params, format_for_llm)
    
    def _extract_keywords(self, query: str, tool_name: str, description: str) -> List[str]:
        """Extract matching keywords for explanation."""
        query_words = set(re.findall(r'\b\w+\b', query.lower()))
        name_words = set(re.findall(r'\b\w+\b', tool_name.lower().replace("_", " ")))
        desc_words = set(re.findall(r'\b\w+\b', description.lower()))
        
        matches = query_words & (name_words | desc_words)
        return list(matches)[:5]  # Top 5 matches
    
    def _extract_parameters(self, func) -> Dict[str, Any]:
        """Extract parameter information from function."""
        try:
            sig = signature(func)
            params = {}
            
            for name, param in sig.parameters.items():
                if name in ('self', 'cls'):
                    continue
                
                param_info = {
                    "type": "any",
                    "required": param.default is Parameter.empty
                }
                
                if param.annotation is not Parameter.empty:
                    param_info["type"] = str(param.annotation).replace("<class '", "").replace("'>", "")
                
                if param.default is not Parameter.empty:
                    param_info["default"] = str(param.default)
                
                params[name] = param_info
            
            return params
        except Exception:
            return {}
    
    def _format_for_llm(self, results: List[SemanticToolResult]) -> str:
        """Format results for LLM."""
        if not results:
            return "No tools found matching your query."
        
        lines = [f"Found {len(results)} relevant tool(s):\n"]
        
        for i, result in enumerate(results, 1):
            lines.append(f"{i}. {result.name}")
            lines.append(f"   Skill: {result.skill}")
            lines.append(f"   Relevance: {result.similarity_score:.2f}")
            if result.matched_keywords:
                lines.append(f"   Matched: {', '.join(result.matched_keywords)}")
            lines.append(f"   Description: {result.description[:200]}")
            
            if result.parameters:
                lines.append("   Parameters:")
                for param_name, param_info in result.parameters.items():
                    required = "required" if param_info.get("required") else "optional"
                    param_type = param_info.get("type", "any")
                    lines.append(f"     - {param_name} ({param_type}, {required})")
            
            lines.append("")
        
        return "\n".join(lines)
    
    def _result_to_dict(self, result: SemanticToolResult) -> Dict[str, Any]:
        """Convert result to dict."""
        return {
            "name": result.name,
            "description": result.description,
            "parameters": result.parameters,
            "skill": result.skill,
            "similarity_score": result.similarity_score,
            "matched_keywords": result.matched_keywords
        }
    
    def get_stats(self) -> Dict[str, Any]:
        """Get search statistics."""
        return {
            "indexed": self._indexed,
            "num_tools": len(self._tool_names),
            "embedding_provider": self.embedding_provider,
            "model_name": self.model_name if self._model else None,
            "cache_dir": str(self.cache_dir),
            "cache_exists": (self.cache_dir / f"{self._compute_cache_key()}.pkl").exists() if self._indexed else False
        }


# Global instance
_semantic_searcher: Optional[SemanticToolSearcher] = None


def get_semantic_searcher() -> SemanticToolSearcher:
    """Get global semantic searcher instance."""
    global _semantic_searcher
    if _semantic_searcher is None:
        _semantic_searcher = SemanticToolSearcher()
    return _semantic_searcher


def search_tools_semantic(query: str, top_k: int = 5) -> str:
    """Search tools using semantic similarity.
    
    This understands meaning, not just keywords.
    Works with queries in any language.
    
    Args:
        query: Natural language description
        top_k: Number of results
        
    Returns:
        Formatted list of relevant tools with similarity scores
        
    Examples:
        >>> search_tools_semantic("how to find patient info")
        >>> search_tools_semantic("cách tìm thông tin bệnh nhân")  # Vietnamese!
        >>> search_tools_semantic("retrieve medical records")
    """
    searcher = get_semantic_searcher()
    return searcher.search(query, top_k=top_k)


def index_all_tools() -> int:
    """Build semantic index for all tools.
    
    Call this once at startup for faster searches.
    
    Returns:
        Number of tools indexed
    """
    searcher = get_semantic_searcher()
    return searcher.index_tools()


def get_search_stats() -> Dict[str, Any]:
    """Get semantic search statistics."""
    searcher = get_semantic_searcher()
    return searcher.get_stats()
