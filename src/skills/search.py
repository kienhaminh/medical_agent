"""Semantic Skill Search integration.

Allows agents to discover skills using semantic search.
"""

from .semantic_search import (
    search_skills_semantic,
    get_skill_info,
    index_all_skills,
    get_semantic_search_stats,
    SemanticSkillSearcher
)

# These functions can be registered as tools if needed
# Or used directly by the agent system

__all__ = [
    "search_skills_semantic",
    "get_skill_info", 
    "index_all_skills",
    "get_semantic_search_stats",
    "SemanticSkillSearcher"
]
