"""Tool Pool for managing and organizing tools by skills.

The ToolPool provides a unified interface for accessing tools across all skills,
with support for skill-based organization and query-based tool selection.
"""

from typing import Callable, Dict, List, Optional, Any, Union
from dataclasses import dataclass, field

from ..skills.base import Skill


@dataclass
class ToolInfo:
    """Information about a registered tool."""
    name: str
    func: Callable
    skill_name: str
    description: str = ""
    implementation_type: str = "code"  # code, config, api, composite
    config: Optional[Dict[str, Any]] = None


class ToolPool:
    """Central pool for managing all tools organized by skills.
    
    The ToolPool provides a unified interface for:
    - Registering tools from skills (code or config-based)
    - Query-based tool discovery
    - Skill-based tool organization
    - Dynamic tool creation from configuration
    
    Usage:
        >>> pool = ToolPool()
        >>> pool.register_from_skill(skill)
        >>> tools = pool.get_for_query("tìm bệnh nhân")
        >>> 
        >>> # Register config-based tool
        >>> pool.register_from_config("query_drug", {
        ...     "type": "api",
        ...     "endpoint": "https://api.drugs.com/search",
        ...     "method": "GET"
        ... }, skill_name="pharmacy")
    """
    
    _instance: Optional["ToolPool"] = None
    _tools: Dict[str, ToolInfo]
    _by_skill: Dict[str, List[str]]
    _config_loaders: Dict[str, Callable]
    
    def __new__(cls) -> "ToolPool":
        """Create or return existing singleton instance."""
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._tools = {}
            cls._instance._by_skill = {}
            cls._instance._config_loaders = {}
            cls._instance._register_default_loaders()
        return cls._instance
    
    def _register_default_loaders(self) -> None:
        """Register default configuration loaders."""
        self._config_loaders["api"] = self._load_api_tool
        self._config_loaders["composite"] = self._load_composite_tool
    
    def register(self, name: str, func: Callable, skill_name: str = "general", 
                 implementation_type: str = "code", config: Optional[Dict] = None) -> None:
        """Register a single tool.
        
        Args:
            name: Tool name/symbol
            func: Callable tool function
            skill_name: Name of the skill this tool belongs to
            implementation_type: Type of implementation (code, config, api, composite)
            config: Optional configuration dict for config-based tools
        """
        # Get description — BaseTool exposes .description; plain functions use __doc__
        description = (
            getattr(func, "description", None)
            or getattr(func, "__doc__", None)
            or ""
        )
        
        self._tools[name] = ToolInfo(
            name=name,
            func=func,
            skill_name=skill_name,
            description=description,
            implementation_type=implementation_type,
            config=config
        )
        
        # Track by skill
        if skill_name not in self._by_skill:
            self._by_skill[skill_name] = []
        if name not in self._by_skill[skill_name]:
            self._by_skill[skill_name].append(name)
    
    def register_from_config(self, name: str, config: Dict[str, Any], 
                            skill_name: str = "general") -> None:
        """Register a tool from configuration.
        
        Supports:
        - API tools: {"type": "api", "endpoint": "...", "method": "GET"}
        - Composite tools: {"type": "composite", "steps": [...]}
        
        Args:
            name: Tool name
            config: Configuration dictionary
            skill_name: Skill this tool belongs to
        """
        tool_type = config.get("type", "api")
        
        if tool_type in self._config_loaders:
            func = self._config_loaders[tool_type](name, config)
            self.register(name, func, skill_name, implementation_type=tool_type, config=config)
        else:
            raise ValueError(f"Unknown tool type: {tool_type}")
    
    def _load_api_tool(self, name: str, config: Dict[str, Any]) -> Callable:
        """Create an API tool from configuration."""
        import requests
        
        endpoint = config.get("endpoint", "")
        method = config.get("method", "GET").upper()
        headers = config.get("headers", {})
        timeout = config.get("timeout", 30)
        
        def api_tool(**kwargs):
            """Auto-generated API tool."""
            try:
                if method == "GET":
                    response = requests.get(endpoint, params=kwargs, headers=headers, timeout=timeout)
                elif method == "POST":
                    response = requests.post(endpoint, json=kwargs, headers=headers, timeout=timeout)
                elif method == "PUT":
                    response = requests.put(endpoint, json=kwargs, headers=headers, timeout=timeout)
                elif method == "DELETE":
                    response = requests.delete(endpoint, params=kwargs, headers=headers, timeout=timeout)
                else:
                    response = requests.request(method, endpoint, json=kwargs, headers=headers, timeout=timeout)
                
                response.raise_for_status()
                return response.json()
            except requests.exceptions.RequestException as e:
                return {"error": f"API call failed: {str(e)}", "tool": name}
            except Exception as e:
                return {"error": f"Unexpected error: {str(e)}", "tool": name}
        
        api_tool.__name__ = name
        api_tool.__doc__ = config.get("description", f"API tool: {name}")
        
        return api_tool
    
    def _load_composite_tool(self, name: str, config: Dict[str, Any]) -> Callable:
        """Create a composite tool that chains multiple tools."""
        steps = config.get("steps", [])
        
        def composite_tool(**kwargs):
            """Auto-generated composite tool."""
            results = []
            context = kwargs.copy()
            
            for step in steps:
                tool_name = step.get("tool")
                params = step.get("params", {})
                
                # Resolve parameter values from context
                resolved_params = {}
                for key, value in params.items():
                    if isinstance(value, str) and value.startswith("$"):
                        # Reference to context variable
                        var_name = value[1:]
                        resolved_params[key] = context.get(var_name)
                    else:
                        resolved_params[key] = value
                
                # Execute tool
                tool_info = self._tools.get(tool_name)
                if tool_info:
                    result = tool_info.func(**resolved_params)
                    results.append({"step": tool_name, "result": result})
                    
                    # Store result in context for next steps
                    output_var = step.get("output_as")
                    if output_var:
                        context[output_var] = result
                else:
                    results.append({"step": tool_name, "error": "Tool not found"})
            
            return {"results": results, "final_context": context}
        
        composite_tool.__name__ = name
        composite_tool.__doc__ = config.get("description", f"Composite tool: {name}")
        
        return composite_tool
    
    def register_config_loader(self, tool_type: str, loader: Callable) -> None:
        """Register a custom configuration loader.
        
        Args:
            tool_type: Type identifier for this loader
            loader: Function that takes (name, config) and returns a callable
        """
        self._config_loaders[tool_type] = loader
    
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

        Supports both plain callables and LangChain BaseTool instances
        (ToolRegistry now stores BaseTool objects).

        Args:
            registry: ToolRegistry instance to import from
        """
        tools = registry.list_tools()
        for tool in tools:
            # BaseTool has .name; plain functions have .__name__
            name = getattr(tool, "name", getattr(tool, "__name__", str(tool)))
            self.register(name, tool, skill_name="builtin")
