"""Skill system for AI Agent.

Provides infrastructure for organizing tools into logical skill groups
with metadata-driven discovery and selection.

Key Components:
    - Skill: Base class for skill definitions
    - SkillRegistry: Registry for skill management and discovery
    
Usage:
    >>> from src.skills import SkillRegistry
    >>> 
    >>> # Discover available skills
    >>> registry = SkillRegistry()
    >>> skills = registry.list_skills()
    >>> 
    >>> # Select skills for a query
    >>> relevant = registry.select_skills("tìm bệnh nhân Nguyễn Văn A")
"""

from .base import Skill, SkillMetadata
from .registry import SkillRegistry

__all__ = ["Skill", "SkillMetadata", "SkillRegistry"]
