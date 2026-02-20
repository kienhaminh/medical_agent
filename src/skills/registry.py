"""Skill registry for managing and discovering available skills."""

import os
import re
from typing import Dict, List, Optional, Any
from pathlib import Path

from .base import Skill, SkillMetadata


class SkillRegistry:
    """Registry for managing skills and skill discovery.
    
    Manages a centralized collection of skills, enabling:
    - Skill registration from directories containing SKILL.md
    - Skill lookup by name
    - Skill selection based on query content
    - Listing all available skills
    
    Usage:
        >>> registry = SkillRegistry()
        >>> registry.discover_skills("src/skills")
        >>> skills = registry.select_skills("tìm bệnh nhân")
    """
    
    _instance: Optional["SkillRegistry"] = None
    _skills: Dict[str, Skill]
    
    def __new__(cls) -> "SkillRegistry":
        """Create or return existing singleton instance."""
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._skills = {}
        return cls._instance
    
    def register(self, skill: Skill) -> None:
        """Register a skill.
        
        Args:
            skill: Skill instance to register
            
        Raises:
            ValueError: If skill with same name already registered
        """
        if skill.name in self._skills:
            raise ValueError(f"Skill '{skill.name}' already registered")
        
        self._skills[skill.name] = skill
    
    def get(self, name: str) -> Optional[Skill]:
        """Get skill by name.
        
        Args:
            name: Skill name to lookup
            
        Returns:
            Skill instance if found, None otherwise
        """
        return self._skills.get(name)
    
    def list_skills(self) -> List[Dict[str, Any]]:
        """List all registered skills with metadata.
        
        Returns:
            List of skill dictionaries
        """
        return [
            skill.to_dict()
            for skill in sorted(self._skills.values(), key=lambda s: s.name)
        ]
    
    def get_all_skills(self) -> List[Skill]:
        """Get all registered skill instances.
        
        Returns:
            List of Skill instances
        """
        return list(self._skills.values())
    
    def discover_skills(self, skills_dir: str) -> int:
        """Auto-discover and register skills from directory.
        
        Scans subdirectories for SKILL.md files and registers them.
        
        Args:
            skills_dir: Path to skills directory
            
        Returns:
            Number of skills discovered and registered
        """
        skills_path = Path(skills_dir)
        if not skills_path.exists():
            return 0
        
        count = 0
        for subdir in skills_path.iterdir():
            if subdir.is_dir():
                skill_md = subdir / "SKILL.md"
                if skill_md.exists():
                    try:
                        skill = Skill(str(subdir))
                        skill.load_tools_from_module()
                        self.register(skill)
                        count += 1
                    except Exception as e:
                        print(f"[ERROR] Failed to load skill from {subdir}: {e}")
        
        return count
    
    def select_skills(self, query: str, top_k: int = 3) -> List[Skill]:
        """Select appropriate skills based on query content.
        
        Uses keyword matching and semantic relevance to determine
        which skills are most appropriate for the given query.
        
        Args:
            query: User query string
            top_k: Maximum number of skills to return
            
        Returns:
            List of relevant Skill instances, sorted by relevance
        """
        query_lower = query.lower()
        scores: Dict[str, float] = {}
        
        for name, skill in self._skills.items():
            score = 0.0
            
            # Check keywords
            for keyword in skill.metadata.keywords:
                if keyword.lower() in query_lower:
                    score += 2.0
            
            # Check when_to_use patterns
            for pattern in skill.metadata.when_to_use:
                # Simple substring matching
                pattern_words = pattern.lower().split()
                for word in pattern_words:
                    if len(word) > 2 and word in query_lower:  # Skip short words
                        score += 1.0
            
            # Check description
            desc_words = skill.description.lower().split()
            for word in desc_words:
                if len(word) > 3 and word in query_lower:
                    score += 0.5
            
            # Skill name matching
            if skill.name.replace("-", " ").lower() in query_lower:
                score += 3.0
            
            if score > 0:
                scores[name] = score
        
        # Sort by score and return top_k
        sorted_skills = sorted(scores.items(), key=lambda x: x[1], reverse=True)
        return [self._skills[name] for name, _ in sorted_skills[:top_k]]
    
    def get_skill_tools(self, skill_name: str) -> List[str]:
        """Get tool names for a specific skill.
        
        Args:
            skill_name: Name of the skill
            
        Returns:
            List of tool names
        """
        skill = self._skills.get(skill_name)
        if skill:
            return skill.list_tools()
        return []
    
    def reset(self) -> None:
        """Clear all registered skills.
        
        Primarily for testing purposes.
        """
        self._skills.clear()
