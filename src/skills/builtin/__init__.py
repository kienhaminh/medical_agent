"""Skill Search builtin tools for dynamic skill discovery.

These tools allow agents to discover skills on demand,
enabling dynamic skill selection without hardcoding skill names.
"""

from ...tools.registry import ToolRegistry
from ..semantic_search import (
    search_skills_semantic,
    get_skill_info,
    index_all_skills,
    get_semantic_search_stats,
)

_registry = ToolRegistry()

# Main skill search - agents use this to find relevant skills
_registry.register(
    search_skills_semantic,
    scope="global",
    symbol="search_skills_semantic",
    allow_overwrite=True
)

# Get detailed info about a specific skill
_registry.register(
    get_skill_info,
    scope="global",
    symbol="get_skill_info",
    allow_overwrite=True
)

# Index all skills (call once at startup)
_registry.register(
    index_all_skills,
    scope="global",
    symbol="index_all_skills",
    allow_overwrite=True
)

# Get search statistics
_registry.register(
    get_semantic_search_stats,
    scope="global",
    symbol="get_semantic_search_stats",
    allow_overwrite=True
)
