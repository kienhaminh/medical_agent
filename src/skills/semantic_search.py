"""Semantic Skill Search - Vector-based skill discovery.

Uses embeddings to find semantically similar skills based on meaning.
Enables multi-language skill selection and better intent matching.

Usage:
    >>> from src.skills.semantic_search import SemanticSkillSearcher
    >>> searcher = SemanticSkillSearcher()
    >>> searcher.index_skills()  # One-time indexing
    >>> results = searcher.search("làm thế nào để chẩn đoán bệnh")
    # Returns diagnosis skill even though query is in Vietnamese
"""

import json
import re
import os
import hashlib
import pickle
from pathlib import Path
from typing import List, Dict, Any, Optional, Tuple
from dataclasses import dataclass
import numpy as np

from .registry import SkillRegistry
from .base import Skill


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
class SemanticSkillResult:
    """Result from semantic skill search."""
    name: str
    description: str
    when_to_use: List[str]
    when_not_to_use: List[str]
    keywords: List[str]
    tools: List[str]
    similarity_score: float
    matched_concepts: List[str]


class SemanticSkillSearcher:
    """Semantic skill search using embeddings.
    
    Features:
    - Vector similarity search for skill selection
    - Multi-language support (queries in any language)
    - Rich skill context (when_to_use, examples, etc.)
    - Caching for fast repeated searches
    - Fallback to keyword matching if embeddings unavailable
    
    Usage:
        >>> searcher = SemanticSkillSearcher()
        >>> searcher.index_skills()  # Build index once
        >>> 
        >>> # Search in any language
        >>> results = searcher.search("how to find patient info", top_k=3)
        >>> results = searcher.search("cách tìm thông tin bệnh nhân", top_k=3)
    """
    
    # Default embedding model
    DEFAULT_MODEL = "all-MiniLM-L6-v2"
    MULTILINGUAL_MODEL = "paraphrase-multilingual-MiniLM-L12-v2"
    
    def __init__(
        self,
        skill_registry: Optional[SkillRegistry] = None,
        model_name: Optional[str] = None,
        embedding_provider: str = "auto",  # auto, sentence_transformers, openai, keyword
        cache_dir: Optional[str] = None,
        api_key: Optional[str] = None,
        use_multilingual: bool = False  # Set to True for better non-English support
    ):
        """Initialize semantic skill searcher.
        
        Args:
            skill_registry: SkillRegistry instance
            model_name: Sentence transformer model name
            embedding_provider: Which embedding provider to use
            cache_dir: Directory to cache embeddings
            api_key: OpenAI API key (if using OpenAI embeddings)
            use_multilingual: Use multilingual model for better non-English support
        """
        self.registry = skill_registry or SkillRegistry()
        self.embedding_provider = embedding_provider
        self.api_key = api_key or os.getenv("OPENAI_API_KEY")
        
        # Choose model
        if model_name:
            self.model_name = model_name
        elif use_multilingual:
            self.model_name = self.MULTILINGUAL_MODEL
        else:
            self.model_name = self.DEFAULT_MODEL
        
        self._model = None
        
        # Cache
        self.cache_dir = Path(cache_dir) if cache_dir else Path.home() / ".medical_agent" / "skill_embeddings"
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        
        # Indexed data
        self._indexed = False
        self._skill_names: List[str] = []
        self._skill_texts: List[str] = []
        self._skill_embeddings: Optional[np.ndarray] = None
        self._skill_info: Dict[str, Skill] = {}
    
    def _get_model(self):
        """Lazy load embedding model."""
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
                raise ImportError("sentence-transformers not installed")
            print(f"[SemanticSkillSearch] Loading model: {self.model_name}")
            self._model = SentenceTransformer(self.model_name)
            
        elif self.embedding_provider == "openai":
            if not OPENAI_AVAILABLE:
                raise ImportError("openai not installed")
            if not self.api_key:
                raise ValueError("OpenAI API key required")
            print("[SemanticSkillSearch] Using OpenAI embeddings")
        
        return self._model
    
    def _compute_embedding(self, texts: List[str]) -> np.ndarray:
        """Compute embeddings for texts."""
        if self.embedding_provider == "sentence_transformers":
            model = self._get_model()
            return model.encode(texts, convert_to_numpy=True, show_progress_bar=False)
        
        elif self.embedding_provider == "openai":
            import openai
            client = openai.OpenAI(api_key=self.api_key)
            
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
        """Compute cache key based on current skills."""
        skills = self.registry.list_skills()
        skills_str = json.dumps(skills, sort_keys=True)
        return hashlib.md5(skills_str.encode()).hexdigest()
    
    def _save_cache(self):
        """Save embeddings to cache."""
        cache_key = self._compute_cache_key()
        cache_file = self.cache_dir / f"{cache_key}.pkl"
        
        data = {
            "skill_names": self._skill_names,
            "skill_texts": self._skill_texts,
            "skill_embeddings": self._skill_embeddings,
            "skill_info": {name: skill.to_dict() for name, skill in self._skill_info.items()},
            "model_name": self.model_name,
            "provider": self.embedding_provider
        }
        
        with open(cache_file, "wb") as f:
            pickle.dump(data, f)
        
        print(f"[SemanticSkillSearch] Cached embeddings to {cache_file}")
    
    def _load_cache(self) -> bool:
        """Load embeddings from cache if available."""
        cache_key = self._compute_cache_key()
        cache_file = self.cache_dir / f"{cache_key}.pkl"
        
        if not cache_file.exists():
            return False
        
        try:
            with open(cache_file, "rb") as f:
                data = pickle.load(f)
            
            if data.get("model_name") != self.model_name:
                return False
            if data.get("provider") != self.embedding_provider:
                return False
            
            self._skill_names = data["skill_names"]
            self._skill_texts = data["skill_texts"]
            self._skill_embeddings = data["skill_embeddings"]
            # Note: skill_info stored as dict, need to convert back if needed
            self._indexed = True
            
            print(f"[SemanticSkillSearch] Loaded {len(self._skill_names)} skills from cache")
            return True
            
        except Exception as e:
            print(f"[SemanticSkillSearch] Cache load failed: {e}")
            return False
    
    def _create_skill_text(self, skill: Skill) -> str:
        """Create rich text representation of skill for embedding."""
        parts = [skill.name.replace("-", " ")]
        
        if skill.description:
            parts.append(skill.description)
        
        # Add when_to_use patterns (very important for matching)
        for use_case in skill.metadata.when_to_use:
            parts.append(f"use when: {use_case}")
        
        # Add examples
        for example in skill.metadata.examples:
            parts.append(f"example: {example}")
        
        # Add keywords
        if skill.metadata.keywords:
            parts.append(f"keywords: {', '.join(skill.metadata.keywords)}")
        
        return " | ".join(parts)
    
    def index_skills(self, force_reindex: bool = False) -> int:
        """Build semantic index of all skills.
        
        Args:
            force_reindex: Force rebuild even if cache exists
            
        Returns:
            Number of skills indexed
        """
        # Try cache first
        if not force_reindex and self._load_cache():
            return len(self._skill_names)
        
        # Get all skills
        all_skills = self.registry.get_all_skills()
        
        if not all_skills:
            print("[SemanticSkillSearch] No skills to index")
            return 0
        
        # Prepare texts
        self._skill_names = []
        self._skill_texts = []
        self._skill_info = {}
        
        for skill in all_skills:
            # Create rich text
            text = self._create_skill_text(skill)
            
            self._skill_names.append(skill.name)
            self._skill_texts.append(text)
            self._skill_info[skill.name] = skill
        
        if not self._skill_texts:
            print("[SemanticSkillSearch] No valid skills to index")
            return 0
        
        # Compute embeddings
        print(f"[SemanticSkillSearch] Indexing {len(self._skill_texts)} skills...")
        
        if self.embedding_provider == "keyword":
            # Skip embedding computation for keyword fallback
            self._indexed = True
            return len(self._skill_names)
        
        self._skill_embeddings = self._compute_embedding(self._skill_texts)
        self._indexed = True
        
        # Save to cache
        self._save_cache()
        
        return len(self._skill_names)
    
    def _cosine_similarity(self, a: np.ndarray, b: np.ndarray) -> np.ndarray:
        """Compute cosine similarity between vectors."""
        a_norm = a / np.linalg.norm(a, axis=1, keepdims=True)
        b_norm = b / np.linalg.norm(b, axis=1, keepdims=True)
        return np.dot(a_norm, b_norm.T).flatten()
    
    def search(
        self,
        query: str,
        top_k: int = 3,
        min_score: float = 0.3,
        format_for_llm: bool = True
    ) -> str:
        """Semantic search for skills.
        
        Args:
            query: Natural language query (any language)
            top_k: Number of results
            min_score: Minimum similarity score
            format_for_llm: Format for LLM consumption
            
        Returns:
            Formatted search results
        """
        # Ensure indexed
        if not self._indexed:
            self.index_skills()
        
        if not self._skill_names:
            return "No skills available."
        
        # Use semantic or fallback
        if self.embedding_provider == "keyword" or self._skill_embeddings is None:
            return self._keyword_search(query, top_k, format_for_llm)
        
        # Compute query embedding
        query_embedding = self._compute_embedding([query])
        
        # Compute similarities
        similarities = self._cosine_similarity(query_embedding, self._skill_embeddings)
        
        # Get top-k
        top_indices = np.argsort(similarities)[::-1][:top_k]
        
        results = []
        for idx in top_indices:
            score = float(similarities[idx])
            if score < min_score:
                continue
            
            name = self._skill_names[idx]
            skill = self._skill_info[name]
            
            # Extract matched concepts
            matched_concepts = self._extract_concepts(query, skill)
            
            result = SemanticSkillResult(
                name=name,
                description=skill.description,
                when_to_use=skill.metadata.when_to_use,
                when_not_to_use=skill.metadata.when_not_to_use,
                keywords=skill.metadata.keywords,
                tools=skill.list_tools(),
                similarity_score=score,
                matched_concepts=matched_concepts
            )
            results.append(result)
        
        if format_for_llm:
            return self._format_for_llm(results)
        else:
            return json.dumps([self._result_to_dict(r) for r in results], indent=2)
    
    def _keyword_search(self, query: str, top_k: int, format_for_llm: bool) -> str:
        """Fallback keyword-based search using registry."""
        skills = self.registry.select_skills(query, top_k=top_k)
        
        results = []
        for skill in skills:
            result = SemanticSkillResult(
                name=skill.name,
                description=skill.description,
                when_to_use=skill.metadata.when_to_use,
                when_not_to_use=skill.metadata.when_not_to_use,
                keywords=skill.metadata.keywords,
                tools=skill.list_tools(),
                similarity_score=0.5,  # Default for keyword match
                matched_concepts=[]
            )
            results.append(result)
        
        if format_for_llm:
            return self._format_for_llm(results)
        else:
            return json.dumps([self._result_to_dict(r) for r in results], indent=2)
    
    def _extract_concepts(self, query: str, skill: Skill) -> List[str]:
        """Extract matching concepts for explanation."""
        query_lower = query.lower()
        concepts = []
        
        # Check keywords
        for kw in skill.metadata.keywords:
            if kw.lower() in query_lower:
                concepts.append(kw)
        
        # Check when_to_use
        for use_case in skill.metadata.when_to_use:
            words = use_case.lower().split()
            for word in words:
                if len(word) > 3 and word in query_lower:
                    concepts.append(word)
        
        return list(set(concepts))[:5]
    
    def _format_for_llm(self, results: List[SemanticSkillResult]) -> str:
        """Format results for LLM."""
        if not results:
            return "No skills found matching your query."
        
        lines = [f"Found {len(results)} relevant skill(s):\n"]
        
        for i, result in enumerate(results, 1):
            lines.append(f"{i}. {result.name}")
            lines.append(f"   Relevance: {result.similarity_score:.2f}")
            
            if result.matched_concepts:
                lines.append(f"   Matched concepts: {', '.join(result.matched_concepts)}")
            
            lines.append(f"   Description: {result.description}")
            
            if result.when_to_use:
                lines.append("   Use when:")
                for use_case in result.when_to_use[:3]:  # Top 3
                    lines.append(f"     - {use_case}")
            
            if result.tools:
                lines.append(f"   Available tools: {', '.join(result.tools[:5])}")
            
            lines.append("")
        
        return "\n".join(lines)
    
    def _result_to_dict(self, result: SemanticSkillResult) -> Dict[str, Any]:
        """Convert result to dict."""
        return {
            "name": result.name,
            "description": result.description,
            "when_to_use": result.when_to_use,
            "when_not_to_use": result.when_not_to_use,
            "keywords": result.keywords,
            "tools": result.tools,
            "similarity_score": result.similarity_score,
            "matched_concepts": result.matched_concepts
        }
    
    def get_skill_details(self, skill_name: str) -> str:
        """Get full details for a specific skill."""
        skill = self.registry.get(skill_name)
        
        if not skill:
            return f"Skill '{skill_name}' not found."
        
        lines = [
            f"Skill: {skill.name}",
            f"Description: {skill.description}",
            ""
        ]
        
        if skill.metadata.when_to_use:
            lines.append("When to use:")
            for item in skill.metadata.when_to_use:
                lines.append(f"  - {item}")
            lines.append("")
        
        if skill.metadata.when_not_to_use:
            lines.append("When NOT to use:")
            for item in skill.metadata.when_not_to_use:
                lines.append(f"  - {item}")
            lines.append("")
        
        if skill.metadata.examples:
            lines.append("Examples:")
            for example in skill.metadata.examples:
                lines.append(f"  - {example}")
            lines.append("")
        
        if skill.list_tools():
            lines.append(f"Tools: {', '.join(skill.list_tools())}")
        
        return "\n".join(lines)
    
    def get_stats(self) -> Dict[str, Any]:
        """Get search statistics."""
        return {
            "indexed": self._indexed,
            "num_skills": len(self._skill_names),
            "embedding_provider": self.embedding_provider,
            "model_name": self.model_name if self._model else None,
            "cache_dir": str(self.cache_dir),
            "cache_exists": (self.cache_dir / f"{self._compute_cache_key()}.pkl").exists() if self._indexed else False
        }


# Global instance
_semantic_skill_searcher: Optional[SemanticSkillSearcher] = None


def get_semantic_skill_searcher() -> SemanticSkillSearcher:
    """Get global semantic searcher instance."""
    global _semantic_skill_searcher
    if _semantic_skill_searcher is None:
        _semantic_skill_searcher = SemanticSkillSearcher()
    return _semantic_skill_searcher


def search_skills_semantic(query: str, top_k: int = 3) -> str:
    """Search skills using semantic similarity.
    
    Args:
        query: Natural language description (any language)
        top_k: Number of results
        
    Returns:
        Formatted list of relevant skills
        
    Examples:
        >>> search_skills_semantic("how to manage patients")
        >>> search_skills_semantic("chẩn đoán bệnh")  # Vietnamese!
        >>> search_skills_semantic("xử lý ảnh y tế")
    """
    searcher = get_semantic_skill_searcher()
    return searcher.search(query, top_k=top_k)


def get_skill_info(skill_name: str) -> str:
    """Get detailed information about a specific skill.
    
    Args:
        skill_name: Name of the skill
        
    Returns:
        Complete skill documentation
    """
    searcher = get_semantic_skill_searcher()
    return searcher.get_skill_details(skill_name)


def index_all_skills() -> int:
    """Build semantic index for all skills.
    
    Call this once at startup.
    
    Returns:
        Number of skills indexed
    """
    searcher = get_semantic_skill_searcher()
    return searcher.index_skills()


def get_semantic_search_stats() -> Dict[str, Any]:
    """Get semantic search statistics."""
    searcher = get_semantic_skill_searcher()
    return searcher.get_stats()
