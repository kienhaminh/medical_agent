"""Skill registry with filesystem discovery and hot-reload."""

import logging
import os
import hashlib
from typing import Dict, List, Optional, Any
from pathlib import Path
from datetime import datetime
from dataclasses import dataclass

logger = logging.getLogger(__name__)

from .base import Skill, SkillMetadata


@dataclass
class SkillSource:
    """Source information for a skill."""
    type: str  # filesystem, dynamic
    path: Optional[str] = None
    last_modified: Optional[datetime] = None
    file_hash: Optional[str] = None


class SkillRegistry:
    """Registry for managing skills with filesystem discovery and hot-reload.

    Features:
    - Filesystem-based skill discovery (core/custom/external directories)
    - Hot-reload from filesystem changes
    - Dynamic skill registration

    Usage:
        >>> registry = SkillRegistry()
        >>> registry.discover_skills(["src/skills"])
        >>> skills = registry.get_all_skills()
    """

    _instance: Optional["SkillRegistry"] = None
    _skills: Dict[str, Skill]
    _skill_sources: Dict[str, SkillSource]
    _watchers: Dict[str, Any]  # File watchers for hot-reload

    def __new__(cls) -> "SkillRegistry":
        """Create or return existing singleton instance."""
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._skills = {}
            cls._instance._skill_sources = {}
            cls._instance._watchers = {}
        return cls._instance

    def register(self, skill: Skill, source: Optional[SkillSource] = None) -> None:
        """Register a skill.

        Args:
            skill: Skill instance to register
            source: Optional source information for hot-reload

        Raises:
            ValueError: If skill with same name already registered
        """
        if skill.name in self._skills:
            raise ValueError(f"Skill '{skill.name}' already registered")

        self._skills[skill.name] = skill

        if source:
            self._skill_sources[skill.name] = source

    async def register_skill(
        self,
        name: str,
        description: str,
        skill_path: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
        source_type: str = "dynamic"
    ) -> Skill:
        """Register a new skill dynamically.

        Args:
            name: Skill name
            description: Skill description
            skill_path: Optional filesystem path
            metadata: Optional metadata dict
            source_type: Source type (filesystem, dynamic)

        Returns:
            Registered Skill instance
        """
        if skill_path and os.path.isdir(skill_path):
            # Load from filesystem
            skill = Skill(skill_path)
            skill.load_tools_from_module()

            file_hash = self._calculate_dir_hash(skill_path)

            source = SkillSource(
                type=source_type,
                path=skill_path,
                file_hash=file_hash,
                last_modified=datetime.now()
            )
        else:
            # Create skill from metadata
            metadata_obj = SkillMetadata(
                name=name,
                description=description,
                when_to_use=metadata.get("when_to_use", []) if metadata else [],
                when_not_to_use=metadata.get("when_not_to_use", []) if metadata else [],
                keywords=metadata.get("keywords", []) if metadata else [],
                examples=metadata.get("examples", []) if metadata else []
            )
            skill = Skill._from_metadata(metadata_obj)
            source = SkillSource(type=source_type)

        self.register(skill, source)
        return skill

    def get(self, name: str) -> Optional[Skill]:
        """Get skill by name."""
        return self._skills.get(name)

    def list_skills(self) -> List[Dict[str, Any]]:
        """List all registered skills with metadata."""
        return [
            skill.to_dict()
            for skill in sorted(self._skills.values(), key=lambda s: s.name)
        ]

    def get_all_skills(self) -> List[Skill]:
        """Get all registered skill instances."""
        return list(self._skills.values())

    def discover_skills(
        self,
        skills_dirs: List[str],
        recursive: bool = False
    ) -> int:
        """Auto-discover and register skills from multiple directories.

        Args:
            skills_dirs: List of paths to skills directories
            recursive: Whether to search recursively

        Returns:
            Number of skills discovered and registered
        """
        count = 0

        for skills_dir in skills_dirs:
            skills_path = Path(skills_dir)
            if not skills_path.exists():
                continue

            if recursive:
                skill_mds = list(skills_path.rglob("SKILL.md"))
            else:
                skill_mds = [d / "SKILL.md" for d in skills_path.iterdir() if d.is_dir()]
                skill_mds = [p for p in skill_mds if p.exists()]

            for skill_md in skill_mds:
                skill_dir = skill_md.parent
                try:
                    skill = Skill(str(skill_dir))
                    skill.load_tools_from_module()

                    file_hash = self._calculate_dir_hash(str(skill_dir))

                    source = SkillSource(
                        type="filesystem",
                        path=str(skill_dir),
                        file_hash=file_hash,
                        last_modified=datetime.now()
                    )

                    # Skip if already registered and unchanged
                    if skill.name in self._skills:
                        existing_source = self._skill_sources.get(skill.name)
                        if existing_source and existing_source.file_hash == file_hash:
                            continue

                    self.register(skill, source)
                    count += 1
                except Exception as e:
                    logger.error("Failed to load skill from %s: %s", skill_dir, e)

        return count

    async def reload_skill(self, name: str) -> Optional[Skill]:
        """Reload a skill from its filesystem source.

        Args:
            name: Skill name to reload

        Returns:
            Reloaded Skill instance or None
        """
        if name not in self._skills:
            return None

        source = self._skill_sources.get(name)
        if not source or source.type != "filesystem" or not source.path:
            return None

        # Remove old registration
        old_skill = self._skills[name]
        del self._skills[name]
        if name in self._skill_sources:
            del self._skill_sources[name]

        try:
            skill = Skill(source.path)
            skill.load_tools_from_module()

            file_hash = self._calculate_dir_hash(source.path)
            source.file_hash = file_hash
            source.last_modified = datetime.now()

            self.register(skill, source)
            logger.info("Reloaded skill '%s' from filesystem", name)
            return skill
        except Exception as e:
            logger.error("Failed to reload skill '%s': %s", name, e)
            # Restore old skill on failure
            self._skills[name] = old_skill
            if source:
                self._skill_sources[name] = source

        return None

    async def check_for_changes(self) -> List[str]:
        """Check all filesystem-based skills for changes.

        Returns:
            List of skill names that have changed
        """
        changed = []

        for name, source in self._skill_sources.items():
            if source.type == "filesystem" and source.path:
                current_hash = self._calculate_dir_hash(source.path)
                if current_hash != source.file_hash:
                    changed.append(name)

        return changed

    async def auto_reload(self) -> int:
        """Auto-reload all changed skills.

        Returns:
            Number of skills reloaded
        """
        changed = await self.check_for_changes()

        count = 0
        for name in changed:
            if await self.reload_skill(name):
                count += 1

        return count

    def select_skills(self, query: str, top_k: int = 3) -> List[Skill]:
        """Select appropriate skills based on query content."""
        query_lower = query.lower()
        scores: Dict[str, float] = {}

        for name, skill in self._skills.items():
            score = 0.0

            for keyword in skill.metadata.keywords:
                if keyword.lower() in query_lower:
                    score += 2.0

            for pattern in skill.metadata.when_to_use:
                pattern_words = pattern.lower().split()
                for word in pattern_words:
                    if len(word) > 2 and word in query_lower:
                        score += 1.0

            desc_words = skill.description.lower().split()
            for word in desc_words:
                if len(word) > 3 and word in query_lower:
                    score += 0.5

            if skill.name.replace("-", " ").lower() in query_lower:
                score += 3.0

            if score > 0:
                scores[name] = score

        sorted_skills = sorted(scores.items(), key=lambda x: x[1], reverse=True)
        return [self._skills[name] for name, _ in sorted_skills[:top_k]]

    def unregister(self, name: str) -> bool:
        """Unregister a skill.

        Args:
            name: Skill name to unregister

        Returns:
            True if unregistered, False if not found
        """
        if name in self._skills:
            del self._skills[name]
            if name in self._skill_sources:
                del self._skill_sources[name]
            if name in self._watchers:
                watcher = self._watchers.pop(name)
                if hasattr(watcher, 'stop'):
                    watcher.stop()
            return True
        return False

    def reset(self) -> None:
        """Clear all registered skills and watchers."""
        self._skills.clear()
        self._skill_sources.clear()

        for watcher in self._watchers.values():
            if hasattr(watcher, 'stop'):
                watcher.stop()
        self._watchers.clear()

    def _calculate_dir_hash(self, path: str) -> str:
        """Calculate MD5 hash of directory contents for change detection."""
        hash_md5 = hashlib.md5()

        for root, dirs, files in os.walk(path):
            for filename in sorted(files):
                if filename.endswith(('.py', '.md', '.yaml', '.yml', '.json')):
                    filepath = os.path.join(root, filename)
                    try:
                        with open(filepath, "rb") as f:
                            hash_md5.update(f.read())
                    except Exception:
                        pass

        return hash_md5.hexdigest()

    def get_skill_source(self, name: str) -> Optional[SkillSource]:
        """Get source information for a skill."""
        return self._skill_sources.get(name)
