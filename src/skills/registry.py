"""Enhanced Skill registry with database support and hot-reload."""

import logging
import os
import re
import hashlib
import asyncio
from typing import Dict, List, Optional, Any, Callable
from pathlib import Path
from datetime import datetime
from dataclasses import dataclass, field
import yaml

logger = logging.getLogger(__name__)

from .base import Skill, SkillMetadata


@dataclass
class SkillSource:
    """Source information for a skill."""
    type: str  # filesystem, database, plugin, external
    path: Optional[str] = None
    db_id: Optional[int] = None
    last_modified: Optional[datetime] = None
    file_hash: Optional[str] = None


class SkillRegistry:
    """Enhanced registry for managing skills with DB support and hot-reload.
    
    Features:
    - Database-driven skills (no restart required)
    - Hot-reload from filesystem changes
    - Plugin architecture (core/custom/external directories)
    - Dynamic skill registration
    
    Usage:
        >>> registry = SkillRegistry()
        >>> # Load from DB
        >>> await registry.load_from_database()
        >>> # Register new skill dynamically
        >>> await registry.register_skill_from_db(skill_record)
        >>> # Hot reload
        >>> await registry.reload_skill("patient-management")
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
            cls._instance._db_loaded = False
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
        
        # Set up file watcher if source is filesystem
        if source and source.type == "filesystem" and source.path:
            self._setup_file_watcher(skill.name, source.path)
    
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
            source_type: Source type (filesystem, database, dynamic)
            
        Returns:
            Registered Skill instance
        """
        if skill_path and os.path.isdir(skill_path):
            # Load from filesystem
            skill = Skill(skill_path)
            skill.load_tools_from_module()
            
            # Calculate file hash for hot-reload
            file_hash = self._calculate_dir_hash(skill_path)
            
            source = SkillSource(
                type=source_type,
                path=skill_path,
                file_hash=file_hash,
                last_modified=datetime.now()
            )
        else:
            # Create skill from metadata
            skill = self._create_skill_from_metadata(name, description, metadata)
            source = SkillSource(type=source_type)
        
        self.register(skill, source)
        return skill
    
    async def register_skill_from_db(self, db_skill: Any) -> Skill:
        """Register a skill from database record.
        
        Args:
            db_skill: Skill database model instance
            
        Returns:
            Registered Skill instance
        """
        # Create SkillMetadata from DB record
        metadata = SkillMetadata(
            name=db_skill.name,
            description=db_skill.description,
            when_to_use=db_skill.when_to_use or [],
            when_not_to_use=db_skill.when_not_to_use or [],
            keywords=db_skill.keywords or [],
            examples=db_skill.examples or []
        )
        
        # Create skill directory structure in memory
        skill = Skill._from_metadata(metadata)
        
        # Register tools from DB
        if db_skill.tools:
            for tool in db_skill.tools:
                if tool.enabled:
                    tool_func = self._create_tool_from_db(tool)
                    skill.register_tool(tool.name, tool_func)
        
        source = SkillSource(
            type="database",
            db_id=db_skill.id,
            last_modified=db_skill.updated_at
        )
        
        # Remove existing if present (for hot-reload)
        if skill.name in self._skills:
            del self._skills[skill.name]
        
        self.register(skill, source)
        self._db_loaded = True
        
        return skill
    
    def _create_skill_from_metadata(
        self,
        name: str,
        description: str,
        metadata: Optional[Dict[str, Any]]
    ) -> Skill:
        """Create a skill from metadata dict."""
        metadata_obj = SkillMetadata(
            name=name,
            description=description,
            when_to_use=metadata.get("when_to_use", []) if metadata else [],
            when_not_to_use=metadata.get("when_not_to_use", []) if metadata else [],
            keywords=metadata.get("keywords", []) if metadata else [],
            examples=metadata.get("examples", []) if metadata else []
        )
        
        return Skill._from_metadata(metadata_obj)
    
    def _create_tool_from_db(self, db_tool: Any) -> Callable:
        """Create a callable tool from database record."""
        if db_tool.implementation_type == "code" and db_tool.code:
            # Execute code to create function
            # SECURITY: This should be sandboxed in production
            namespace = {}
            exec(db_tool.code, namespace)
            # Find the function (assumes single function defined)
            for name, obj in namespace.items():
                if callable(obj) and not name.startswith("__"):
                    return obj
        
        elif db_tool.implementation_type == "config" and db_tool.config:
            # Create wrapper function from config
            return self._create_api_tool_from_config(db_tool.name, db_tool.config)
        
        # Fallback - return no-op
        def noop(*args, **kwargs):
            return f"Tool {db_tool.name} not properly configured"
        
        return noop
    
    def _create_api_tool_from_config(self, name: str, config: Dict) -> Callable:
        """Create an API tool from configuration."""
        import requests
        
        endpoint = config.get("endpoint", "")
        method = config.get("method", "GET").upper()
        headers = config.get("headers", {})
        
        def api_tool(**kwargs):
            """Auto-generated API tool."""
            try:
                if method == "GET":
                    response = requests.get(endpoint, params=kwargs, headers=headers)
                else:
                    response = requests.request(method, endpoint, json=kwargs, headers=headers)
                
                response.raise_for_status()
                return response.json()
            except Exception as e:
                return f"Error calling {name}: {str(e)}"
        
        api_tool.__name__ = name
        api_tool.__doc__ = config.get("description", f"API tool: {name}")
        
        return api_tool
    
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
    
    async def load_from_database(self) -> int:
        """Load all enabled skills from database.
        
        Returns:
            Number of skills loaded
        """
        from src.config.database import AsyncSessionLocal
        from src.models.skill import Skill as SkillModel
        from sqlalchemy import select
        
        count = 0
        try:
            async with AsyncSessionLocal() as db:
                result = await db.execute(
                    select(SkillModel).where(SkillModel.enabled == True)
                )
                db_skills = result.scalars().all()
                
                for db_skill in db_skills:
                    try:
                        await self.register_skill_from_db(db_skill)
                        count += 1
                    except Exception as e:
                        logger.error("Failed to load skill '%s' from DB: %s", db_skill.name, e)

                self._db_loaded = True
        except Exception as e:
            logger.error("Failed to load skills from database: %s", e)
        
        return count
    
    async def save_to_database(self, skill: Skill, source_type: str = "filesystem") -> int:
        """Save a skill to database.
        
        Args:
            skill: Skill to save
            source_type: Source type marker
            
        Returns:
            Database ID of saved skill
        """
        from src.config.database import AsyncSessionLocal
        from src.models.skill import Skill as SkillModel
        from sqlalchemy import select
        
        async with AsyncSessionLocal() as db:
            # Check if skill exists
            result = await db.execute(
                select(SkillModel).where(SkillModel.name == skill.name)
            )
            existing = result.scalar_one_or_none()
            
            if existing:
                # Update existing
                existing.description = skill.description
                existing.when_to_use = skill.metadata.when_to_use
                existing.when_not_to_use = skill.metadata.when_not_to_use
                existing.keywords = skill.metadata.keywords
                existing.examples = skill.metadata.examples
                existing.source_type = source_type
                db_skill = existing
            else:
                # Create new
                db_skill = SkillModel(
                    name=skill.name,
                    description=skill.description,
                    when_to_use=skill.metadata.when_to_use,
                    when_not_to_use=skill.metadata.when_not_to_use,
                    keywords=skill.metadata.keywords,
                    examples=skill.metadata.examples,
                    source_type=source_type,
                    enabled=True
                )
                db.add(db_skill)
            
            await db.commit()
            await db.refresh(db_skill)
            
            return db_skill.id
    
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
                # Search recursively for SKILL.md files
                skill_mds = list(skills_path.rglob("SKILL.md"))
            else:
                # Only direct subdirectories
                skill_mds = [d / "SKILL.md" for d in skills_path.iterdir() if d.is_dir()]
                skill_mds = [p for p in skill_mds if p.exists()]
            
            for skill_md in skill_mds:
                skill_dir = skill_md.parent
                try:
                    skill = Skill(str(skill_dir))
                    skill.load_tools_from_module()
                    
                    # Calculate file hash
                    file_hash = self._calculate_dir_hash(str(skill_dir))
                    
                    source = SkillSource(
                        type="filesystem",
                        path=str(skill_dir),
                        file_hash=file_hash,
                        last_modified=datetime.now()
                    )
                    
                    # Check if already registered and needs reload
                    if skill.name in self._skills:
                        existing_source = self._skill_sources.get(skill.name)
                        if existing_source and existing_source.file_hash != file_hash:
                            # Skill changed, will be reloaded
                            pass
                        else:
                            # Same skill, skip
                            continue
                    
                    self.register(skill, source)
                    count += 1
                except Exception as e:
                    logger.error("Failed to load skill from %s: %s", skill_dir, e)
        
        return count
    
    async def reload_skill(self, name: str) -> Optional[Skill]:
        """Reload a skill from its source.
        
        Args:
            name: Skill name to reload
            
        Returns:
            Reloaded Skill instance or None
        """
        if name not in self._skills:
            return None
        
        source = self._skill_sources.get(name)
        if not source:
            return None
        
        # Remove old registration
        old_skill = self._skills[name]
        del self._skills[name]
        if name in self._skill_sources:
            del self._skill_sources[name]
        
        try:
            if source.type == "filesystem" and source.path:
                # Reload from filesystem
                skill = Skill(source.path)
                skill.load_tools_from_module()
                
                file_hash = self._calculate_dir_hash(source.path)
                source.file_hash = file_hash
                source.last_modified = datetime.now()
                
                self.register(skill, source)
                logger.info("Reloaded skill '%s' from filesystem", name)
                return skill
                
            elif source.type == "database" and source.db_id:
                # Reload from database
                from src.config.database import AsyncSessionLocal
                from src.models.skill import Skill as SkillModel
                from sqlalchemy import select
                
                async with AsyncSessionLocal() as db:
                    result = await db.execute(
                        select(SkillModel).where(SkillModel.id == source.db_id)
                    )
                    db_skill = result.scalar_one_or_none()
                    
                    if db_skill:
                        return await self.register_skill_from_db(db_skill)
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
            
            # Check keywords
            for keyword in skill.metadata.keywords:
                if keyword.lower() in query_lower:
                    score += 2.0
            
            # Check when_to_use patterns
            for pattern in skill.metadata.when_to_use:
                pattern_words = pattern.lower().split()
                for word in pattern_words:
                    if len(word) > 2 and word in query_lower:
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
                # Stop watcher
                watcher = self._watchers.pop(name)
                if hasattr(watcher, 'stop'):
                    watcher.stop()
            return True
        return False
    
    def reset(self) -> None:
        """Clear all registered skills and watchers."""
        self._skills.clear()
        self._skill_sources.clear()
        
        # Stop all watchers
        for watcher in self._watchers.values():
            if hasattr(watcher, 'stop'):
                watcher.stop()
        self._watchers.clear()
        
        self._db_loaded = False
    
    def _calculate_dir_hash(self, path: str) -> str:
        """Calculate MD5 hash of directory contents for change detection."""
        hash_md5 = hashlib.md5()
        
        for root, dirs, files in os.walk(path):
            # Sort for consistent ordering
            for filename in sorted(files):
                if filename.endswith(('.py', '.md', '.yaml', '.yml', '.json')):
                    filepath = os.path.join(root, filename)
                    try:
                        with open(filepath, "rb") as f:
                            hash_md5.update(f.read())
                    except Exception:
                        pass
        
        return hash_md5.hexdigest()
    
    def _setup_file_watcher(self, skill_name: str, path: str) -> None:
        """Set up file watcher for hot-reload (optional)."""
        # This is a placeholder - actual implementation would use
        # watchdog or similar library
        pass
    
    def get_skill_source(self, name: str) -> Optional[SkillSource]:
        """Get source information for a skill."""
        return self._skill_sources.get(name)
