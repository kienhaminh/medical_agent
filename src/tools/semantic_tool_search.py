"""Semantic Tool Search builtin.

Vector-based tool discovery using embeddings.
"""

from .registry import ToolRegistry
from .semantic_search import (
    search_tools_semantic,
    index_all_tools,
    get_search_stats,
    SemanticToolSearcher
)

_registry = ToolRegistry()

# Semantic search - understands meaning, not just keywords
_registry.register(
    search_tools_semantic,
    scope="global",
    symbol="search_tools_semantic",
    allow_overwrite=True
)

# Index tools for faster search
_registry.register(
    index_all_tools,
    scope="global",
    symbol="index_all_tools",
    allow_overwrite=True
)

# Get search statistics
_registry.register(
    get_search_stats,
    scope="global",
    symbol="get_search_stats",
    allow_overwrite=True
)
