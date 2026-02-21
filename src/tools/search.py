"""Tool Search - Dynamic tool discovery to save system prompt tokens.

Instead of including all tool descriptions in the system prompt (which uses many tokens),
this tool allows the agent to search for tools on demand.

Usage:
    # In system prompt, only include:
    "You have access to tools. Use search_tools(query) to find relevant tools."
    
    # Agent calls:
    search_tools("find patient information")
    # Returns: List of relevant tools with descriptions
"""

import json
import re
from typing import List, Dict, Any, Optional
from dataclasses import dataclass
from inspect import signature, Parameter

from .pool import ToolPool


@dataclass
class ToolSearchResult:
    """Result from tool search."""
    name: str
    description: str
    parameters: Dict[str, Any]
    skill: str
    relevance_score: float


class ToolSearcher:
    """Search tools dynamically to save system prompt tokens.
    
    This class provides intelligent tool search that agents can use
to discover tools without having all descriptions in the system prompt.
    
    Usage:
        >>> searcher = ToolSearcher()
        >>> results = searcher.search("find patient by name")
        >>> print(results[0].description)
    """
    
    def __init__(self, tool_pool: Optional[ToolPool] = None):
        """Initialize tool searcher.
        
        Args:
            tool_pool: ToolPool instance. Creates new if None.
        """
        self.pool = tool_pool or ToolPool()
    
    def search(
        self,
        query: str,
        top_k: int = 5,
        include_params: bool = True,
        format_for_llm: bool = True
    ) -> str:
        """Search for tools matching the query.
        
        Args:
            query: Search query describing what tool is needed
            top_k: Maximum number of tools to return
            include_params: Whether to include parameter schemas
            format_for_llm: If True, returns formatted string for LLM context
            
        Returns:
            Formatted string with tool descriptions (if format_for_llm=True)
            or JSON string with search results
        """
        # Search for tools
        results = self._search_internal(query, top_k)
        
        if format_for_llm:
            return self._format_for_llm(results, include_params)
        else:
            return json.dumps([self._result_to_dict(r) for r in results], indent=2)
    
    def _search_internal(self, query: str, top_k: int) -> List[ToolSearchResult]:
        """Internal search with scoring."""
        query_lower = query.lower()
        query_words = set(re.findall(r'\b\w+\b', query_lower))
        
        results: List[ToolSearchResult] = []
        
        # Get all tools from pool
        all_tools = self.pool.list_tools()
        
        for tool_info in all_tools:
            name = tool_info["name"]
            full_info = self.pool.get_info(name)
            
            if not full_info:
                continue
            
            # Calculate relevance score
            score = self._calculate_relevance(query_lower, query_words, name, full_info)
            
            if score > 0:
                # Extract parameters from function signature
                parameters = self._extract_parameters(full_info.func)
                
                result = ToolSearchResult(
                    name=name,
                    description=full_info.description or "No description available",
                    parameters=parameters,
                    skill=full_info.skill_name,
                    relevance_score=score
                )
                results.append(result)
        
        # Sort by score and return top_k
        results.sort(key=lambda x: x.relevance_score, reverse=True)
        return results[:top_k]
    
    def _calculate_relevance(
        self,
        query_lower: str,
        query_words: set,
        tool_name: str,
        tool_info: Any
    ) -> float:
        """Calculate relevance score for a tool."""
        score = 0.0
        name_lower = tool_name.lower()
        
        # Exact name match (highest priority)
        if name_lower == query_lower:
            score += 10.0
        elif name_lower in query_lower or query_lower in name_lower:
            score += 5.0
        
        # Word matches in name
        name_words = set(re.findall(r'\b\w+\b', name_lower.replace('_', ' ')))
        matching_words = query_words & name_words
        score += len(matching_words) * 2.0
        
        # Description matching
        if tool_info.description:
            desc_lower = tool_info.description.lower()
            
            # Check for key phrases
            for word in query_words:
                if len(word) > 3:
                    if word in desc_lower:
                        score += 1.0
                    # Check word boundaries
                    if re.search(rf'\b{re.escape(word)}\b', desc_lower):
                        score += 0.5
            
            # First line of description match (usually most important)
            first_line = desc_lower.split('\n')[0]
            for word in query_words:
                if len(word) > 3 and word in first_line:
                    score += 1.5
        
        # Skill name matching
        skill_lower = tool_info.skill_name.lower()
        for word in query_words:
            if len(word) > 3 and word in skill_lower:
                score += 0.5
        
        return score
    
    def _extract_parameters(self, func) -> Dict[str, Any]:
        """Extract parameter information from function signature."""
        try:
            sig = signature(func)
            params = {}
            
            for name, param in sig.parameters.items():
                if name in ('self', 'cls'):
                    continue
                
                param_info = {
                    "type": "any",
                    "required": param.default is Parameter.empty
                }
                
                # Try to get type annotation
                if param.annotation is not Parameter.empty:
                    param_info["type"] = str(param.annotation).replace("<class '", "").replace("'>", "")
                
                # Get default value if any
                if param.default is not Parameter.empty:
                    param_info["default"] = str(param.default)
                
                params[name] = param_info
            
            return params
        except Exception:
            return {}
    
    def _format_for_llm(
        self,
        results: List[ToolSearchResult],
        include_params: bool
    ) -> str:
        """Format search results for LLM consumption."""
        if not results:
            return "No tools found matching your query."
        
        lines = [f"Found {len(results)} relevant tool(s):\n"]
        
        for i, result in enumerate(results, 1):
            lines.append(f"{i}. {result.name}")
            lines.append(f"   Skill: {result.skill}")
            lines.append(f"   Description: {result.description[:200]}")
            
            if include_params and result.parameters:
                lines.append("   Parameters:")
                for param_name, param_info in result.parameters.items():
                    required = "required" if param_info.get("required") else "optional"
                    param_type = param_info.get("type", "any")
                    lines.append(f"     - {param_name} ({param_type}, {required})")
            
            lines.append("")  # Empty line between tools
        
        return "\n".join(lines)
    
    def _result_to_dict(self, result: ToolSearchResult) -> Dict[str, Any]:
        """Convert result to dictionary."""
        return {
            "name": result.name,
            "description": result.description,
            "parameters": result.parameters,
            "skill": result.skill,
            "relevance_score": result.relevance_score
        }
    
    def get_tool_details(self, tool_name: str) -> str:
        """Get full details for a specific tool.
        
        Args:
            tool_name: Name of the tool to look up
            
        Returns:
            Formatted tool details or error message
        """
        tool_info = self.pool.get_info(tool_name)
        
        if not tool_info:
            return f"Tool '{tool_name}' not found."
        
        parameters = self._extract_parameters(tool_info.func)
        
        lines = [
            f"Tool: {tool_name}",
            f"Skill: {tool_info.skill_name}",
            f"Type: {tool_info.implementation_type}",
            "",
            "Description:",
            tool_info.description or "No description available",
            "",
        ]
        
        if parameters:
            lines.append("Parameters:")
            for param_name, param_info in parameters.items():
                required = "required" if param_info.get("required") else "optional"
                param_type = param_info.get("type", "any")
                default = f", default={param_info['default']}" if "default" in param_info else ""
                lines.append(f"  - {param_name}: {param_type} ({required}){default}")
        else:
            lines.append("Parameters: None")
        
        return "\n".join(lines)
    
    def list_all_tools(self, compact: bool = True) -> str:
        """List all available tools.
        
        Args:
            compact: If True, returns compact list. If False, includes descriptions.
            
        Returns:
            Formatted list of all tools
        """
        all_tools = self.pool.list_tools()
        
        if not all_tools:
            return "No tools registered."
        
        # Group by skill
        by_skill: Dict[str, List[str]] = {}
        for tool in all_tools:
            skill = tool["skill"]
            if skill not in by_skill:
                by_skill[skill] = []
            by_skill[skill].append(tool["name"])
        
        lines = [f"Available Tools ({len(all_tools)} total):\n"]
        
        for skill, tools in sorted(by_skill.items()):
            lines.append(f"[{skill}]")
            if compact:
                lines.append(f"  {', '.join(sorted(tools))}")
            else:
                for tool_name in sorted(tools):
                    tool_info = self.pool.get_info(tool_name)
                    desc = (tool_info.description or "")[:60]
                    if len(tool_info.description or "") > 60:
                        desc += "..."
                    lines.append(f"  - {tool_name}: {desc}")
            lines.append("")
        
        return "\n".join(lines)


# Global instance for easy access
_tool_searcher: Optional[ToolSearcher] = None


def get_tool_searcher() -> ToolSearcher:
    """Get or create global ToolSearcher instance."""
    global _tool_searcher
    if _tool_searcher is None:
        _tool_searcher = ToolSearcher()
    return _tool_searcher


def search_tools(query: str, top_k: int = 5) -> str:
    """Search for tools by query.
    
    This is the main entry point - can be registered as a tool itself.
    
    Args:
        query: Natural language description of what you need
               Examples: "find patient", "search medical records", "get weather"
        top_k: Maximum number of tools to return (default: 5)
        
    Returns:
        Formatted list of relevant tools with descriptions and parameters
        
    Example:
        >>> search_tools("find patient information")
        Found 3 relevant tool(s):
        
        1. query_patient_basic_info
           Skill: patient-management
           Description: Query basic patient demographics...
           Parameters:
             - query (Optional[str], optional)
             - patient_id (Optional[int], optional)
    """
    searcher = get_tool_searcher()
    return searcher.search(query, top_k=top_k)


def get_tool_info(tool_name: str) -> str:
    """Get detailed information about a specific tool.
    
    Use this to get full documentation for a tool before using it.
    
    Args:
        tool_name: Name of the tool to look up
        
    Returns:
        Complete tool documentation including all parameters
        
    Example:
        >>> get_tool_info("query_patient_basic_info")
        Tool: query_patient_basic_info
        Skill: patient-management
        Description: Query basic patient demographics...
        Parameters:
          - query: Optional[str] (optional)
          - patient_id: Optional[int] (optional)
    """
    searcher = get_tool_searcher()
    return searcher.get_tool_details(tool_name)


def list_available_tools(compact: bool = True) -> str:
    """List all available tools grouped by skill.
    
    Args:
        compact: If True, shows only tool names. If False, includes descriptions.
        
    Returns:
        List of all tools organized by skill category
        
    Example:
        >>> list_available_tools()
        Available Tools (12 total):
        
        [patient-management]
          query_patient_basic_info, list_all_patients
        
        [records]
          search_medical_records, add_medical_record
    """
    searcher = get_tool_searcher()
    return searcher.list_all_tools(compact=compact)
