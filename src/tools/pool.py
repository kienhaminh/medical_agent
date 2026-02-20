"""Tool Pool for managing and organizing tools by skills.

The ToolPool provides a unified interface for accessing tools across all skills,
with support for skill-based organization and query-based tool selection.
"""

from typing import Callable, Dict, List, Optional, Any
from dataclasses import dataclass, field

from ..skills.base import Skill


@dataclass
class ToolInfo:
    """Information about a registered tool."""
    name: str
    func: Callable
    skill_name: str
    description: str = ""


class ToolPool:
    """Central pool for managing all tools organized by skills.
    
    The ToolPool provides a unified interface for:
    - Registering tools from skills
    - Query-based tool discovery
    - Skill-based tool organization
    
    Usage:
        >>> pool = ToolPool()
        >>> pool.register_from_skill(skill)
        >>> tools = pool.get_for_query("tìm bệnh nhân")
    """
    
    _instance: Optional["ToolPool"] = None
    _tools: Dict[str, ToolInfo]
    _by_skill: Dict[str, List[str]]
    
    def __new__(cls) -> "ToolPool":
        """Create or return existing singleton instance."""
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._tools = {}
            cls._instance._by_skill = {}
        return cls._instance
    
    def register(self, name: str, func: Callable, skill_name: str = "general") -> None:
        """Register a single tool.
        
        Args:
            name: Tool name/symbol
            func: Callable tool function
            skill_name: Name of the skill this tool belongs to
        """
        # Get description from function docstring
        description = func.__doc__ or ""
        
        self._tools[name] = ToolInfo(
            name=name,
            func=func,
            skill_name=skill_name,
            description=description
        )
        
        # Track by skill
        if skill_name not in self._by_skill:
            self._by_skill[skill_name] = []
        if name not in self._by_skill[skill_name]:
            self._by_skill[skill_name].append(name)
    
    def register_from_skill(self, skill: Skill) -> None:
        """Register all tools from a skill.
        
        Args:
            skill: Skill instance containing tools
        """
        for tool_name, tool_func in skill.tools.items():
            self.register(tool_name, tool_func, skill.name)
    
    def get(self, name: str) -> Optional[Callable]:
        """Get tool function by name.
        
        Args:
            name: Tool name
            
        Returns:
            Tool function if found, None otherwise
        """
        tool_info = self._tools.get(name)
        return tool_info.func if tool_info else None
    
    def get_info(self, name: str) -> Optional[ToolInfo]:
        """Get full tool information.
        
        Args:
            name: Tool name
            
        Returns:
            ToolInfo if found, None otherwise
        """
        return self._tools.get(name)
    
    def get_for_skill(self, skill_name: str) -> List[Callable]:
        """Get all tools for a specific skill.
        
        Args:
            skill_name: Name of the skill
            
        Returns:
            List of tool functions
        """
        tool_names = self._by_skill.get(skill_name, [])
        return [self._tools[name].func for name in tool_names if name in self._tools]
    
    def get_for_query(self, query: str, top_k: int = 10) -> List[Callable]:
        """Get relevant tools based on query content.
        
        Uses simple keyword matching against tool names and descriptions.
        
        Args:
            query: User query string
            top_k: Maximum number of tools to return
            
        Returns:
            List of relevant tool functions
        """
        query_lower = query.lower()
        scores: Dict[str, float] = {}
        
        for name, tool_info in self._tools.items():
            score = 0.0
            
            # Name matching
            if name.lower() in query_lower:
                score += 3.0
            
            # Check individual words in name
            name_words = name.lower().replace("_", " ").split()
            for word in name_words:
                if len(word) > 3 and word in query_lower:
                    score += 1.0
            
            # Description matching
            if tool_info.description:
                desc_lower = tool_info.description.lower()
                # Check key phrases in description
                desc_words = desc_lower.split()
                for word in desc_words:
                    if len(word) > 4 and word in query_lower:
                        score += 0.5
            
            if score > 0:
                scores[name] = score
        
        # Sort by score and return top_k
        sorted_tools = sorted(scores.items(), key=lambda x: x[1], reverse=True)
        return [self._tools[name].func for name, _ in sorted_tools[:top_k]]
    
    def list_tools(self) -> List[Dict[str, Any]]:
        """List all registered tools with metadata.
        
        Returns:
            List of tool information dictionaries
        """
        return [
            {
                "name": info.name,
                "skill": info.skill_name,
                "description": info.description[:100] + "..." if len(info.description) > 100 else info.description
            }
            for info in sorted(self._tools.values(), key=lambda x: x.name)
        ]
    
    def list_by_skill(self) -> Dict[str, List[str]]:
        """Get tools organized by skill.
        
        Returns:
            Dictionary mapping skill names to tool name lists
        """
        return self._by_skill.copy()
    
    def get_all_tools(self) -> List[Callable]:
        """Get all registered tool functions.
        
        Returns:
            List of all tool functions
        """
        return [info.func for info in self._tools.values()]
    
    def get_skill_for_tool(self, tool_name: str) -> Optional[str]:
        """Get the skill name that a tool belongs to.
        
        Args:
            tool_name: Name of the tool
            
        Returns:
            Skill name if found, None otherwise
        """
        tool_info = self._tools.get(tool_name)
        return tool_info.skill_name if tool_info else None
    
    def clear(self) -> None:
        """Clear all registered tools.
        
        Primarily for testing purposes.
        """
        self._tools.clear()
        self._by_skill.clear()
    
    def register_from_registry(self, registry) -> None:
        """Import tools from existing ToolRegistry.
        
        This allows backward compatibility with the existing
        ToolRegistry singleton while migrating to the new pool.
        
        Args:
            registry: ToolRegistry instance to import from
        """
        from ..tools.registry import ToolRegistry
        
        if isinstance(registry, ToolRegistry):
            tools = registry.get_all_tools()
            for tool in tools:
                name = getattr(tool, '__name__', str(tool))
                self.register(name, tool, skill_name="builtin")
