"""Base classes for the skill system."""

from dataclasses import dataclass, field
from typing import Callable, Dict, List, Optional, Any, Union
import yaml
import re
from pathlib import Path


@dataclass
class SkillMetadata:
    """Metadata for a skill parsed from SKILL.md frontmatter."""
    
    name: str
    description: str
    when_to_use: List[str] = field(default_factory=list)
    when_not_to_use: List[str] = field(default_factory=list)
    keywords: List[str] = field(default_factory=list)
    examples: List[str] = field(default_factory=list)
    
    @classmethod
    def from_markdown(cls, content: str) -> "SkillMetadata":
        """Parse metadata from SKILL.md content.
        
        Expects frontmatter in YAML format between --- markers.
        
        Args:
            content: Full markdown content of SKILL.md
            
        Returns:
            SkillMetadata instance
        """
        # Extract frontmatter between --- markers
        pattern = r'^---\s*\n(.*?)\n---\s*\n'
        match = re.search(pattern, content, re.DOTALL)
        
        if not match:
            raise ValueError("No valid frontmatter found in SKILL.md")
        
        frontmatter = match.group(1)
        data = yaml.safe_load(frontmatter)
        
        return cls(
            name=data.get("name", ""),
            description=data.get("description", ""),
            when_to_use=data.get("when_to_use", []),
            when_not_to_use=data.get("when_not_to_use", []),
            keywords=data.get("keywords", []),
            examples=data.get("examples", [])
        )
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "SkillMetadata":
        """Create metadata from dictionary.
        
        Args:
            data: Dictionary with metadata fields
            
        Returns:
            SkillMetadata instance
        """
        return cls(
            name=data.get("name", ""),
            description=data.get("description", ""),
            when_to_use=data.get("when_to_use", []),
            when_not_to_use=data.get("when_not_to_use", []),
            keywords=data.get("keywords", []),
            examples=data.get("examples", [])
        )
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert metadata to dictionary.
        
        Returns:
            Dictionary representation
        """
        return {
            "name": self.name,
            "description": self.description,
            "when_to_use": self.when_to_use,
            "when_not_to_use": self.when_not_to_use,
            "keywords": self.keywords,
            "examples": self.examples,
        }


class Skill:
    """Base class for a skill containing tools and metadata.
    
    A skill is a logical grouping of related tools with metadata
    describing when and how to use them.
    
    Attributes:
        metadata: SkillMetadata parsed from SKILL.md
        tools: Dictionary mapping tool names to callable functions
        skill_dir: Optional Path to the skill directory
    """
    
    def __init__(self, skill_dir: Optional[str] = None, metadata: Optional[SkillMetadata] = None):
        """Initialize skill from directory or metadata.
        
        Args:
            skill_dir: Optional path to skill directory (for filesystem-based skills)
            metadata: Optional SkillMetadata (for DB/dynamic skills)
            
        Raises:
            ValueError: If neither skill_dir nor metadata is provided
            FileNotFoundError: If SKILL.md not found in skill_dir
        """
        self.skill_dir = Path(skill_dir) if skill_dir else None
        
        if metadata:
            self.metadata = metadata
        elif skill_dir:
            self.metadata = self._load_metadata()
        else:
            raise ValueError("Either skill_dir or metadata must be provided")
        
        self.tools: Dict[str, Callable] = {}
        
    @classmethod
    def _from_metadata(cls, metadata: SkillMetadata) -> "Skill":
        """Create a skill from metadata without filesystem.
        
        This is used for database-driven or dynamically created skills.
        
        Args:
            metadata: SkillMetadata instance
            
        Returns:
            Skill instance
        """
        return cls(metadata=metadata)
    
    def _load_metadata(self) -> SkillMetadata:
        """Load metadata from SKILL.md file."""
        if not self.skill_dir:
            raise ValueError("skill_dir not set")
            
        skill_md_path = self.skill_dir / "SKILL.md"
        if not skill_md_path.exists():
            raise FileNotFoundError(f"SKILL.md not found in {self.skill_dir}")
        
        content = skill_md_path.read_text(encoding="utf-8")
        return SkillMetadata.from_markdown(content)
    
    def register_tool(self, name: str, func: Callable) -> None:
        """Register a tool function with this skill.
        
        Args:
            name: Tool name/symbol
            func: Callable tool function
        """
        self.tools[name] = func
    
    def get_tool(self, name: str) -> Optional[Callable]:
        """Get a tool by name.
        
        Args:
            name: Tool name
            
        Returns:
            Tool function if found, None otherwise
        """
        return self.tools.get(name)
    
    def list_tools(self) -> List[str]:
        """List all tool names in this skill.
        
        Returns:
            List of tool names
        """
        return list(self.tools.keys())
    
    def load_tools_from_module(self) -> None:
        """Load tools from tools.py in the skill directory.
        
        This dynamically imports the tools module and registers
        any callable functions that start with an underscore prefix
        (indicating they should be registered).
        """
        if not self.skill_dir:
            return
            
        tools_path = self.skill_dir / "tools.py"
        if not tools_path.exists():
            return
        
        # Import the tools module
        import importlib.util
        module_name = f"skills_{self.metadata.name}_tools"
        spec = importlib.util.spec_from_file_location(module_name, tools_path)
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        
        # Find all callable functions
        for attr_name in dir(module):
            attr = getattr(module, attr_name)
            if callable(attr) and not attr_name.startswith("__"):
                # Register the tool
                self.register_tool(attr_name, attr)
    
    @property
    def name(self) -> str:
        """Get skill name from metadata."""
        return self.metadata.name
    
    @property
    def description(self) -> str:
        """Get skill description."""
        return self.metadata.description
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert skill to dictionary representation.
        
        Returns:
            Dictionary with skill info
        """
        return {
            "name": self.name,
            "description": self.description,
            "when_to_use": self.metadata.when_to_use,
            "when_not_to_use": self.metadata.when_not_to_use,
            "keywords": self.metadata.keywords,
            "tools": self.list_tools(),
            "tool_count": len(self.tools)
        }
