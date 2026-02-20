"""Skill orchestrator for managing multi-skill execution.

The SkillOrchestrator coordinates the execution of multiple skills,
handling dependencies and combining results from different skills.
"""

import logging
from typing import List, Dict, Any, Optional, Callable
from dataclasses import dataclass, field
from collections import OrderedDict

from ..skills.base import Skill
from ..tools.pool import ToolPool
from .skill_selector import SkillSelector

logger = logging.getLogger(__name__)


@dataclass
class SkillExecutionResult:
    """Result of executing a skill."""
    skill_name: str
    success: bool
    tools_used: List[str] = field(default_factory=list)
    results: List[Any] = field(default_factory=list)
    error: Optional[str] = None


class SkillOrchestrator:
    """Orchestrates execution across multiple skills.
    
    Manages the flow of execution through multiple skills,
    handling dependencies and combining results.
    
    Usage:
        >>> orchestrator = SkillOrchestrator()
        >>> results = await orchestrator.execute(
        ...     query="tìm bệnh nhân Nguyễn Văn A và xem hồ sơ",
        ...     context={"user_id": "123"}
        ... )
    """
    
    # Define skill dependencies
    # Some skills may need to be executed before others
    SKILL_DEPENDENCIES: Dict[str, List[str]] = {
        "records": ["patient-management"],  # Need patient before records
        "imaging": ["patient-management"],  # Need patient before imaging
    }
    
    def __init__(
        self,
        skill_selector: Optional[SkillSelector] = None,
        tool_pool: Optional[ToolPool] = None,
        max_skills: int = 3
    ):
        """Initialize skill orchestrator.
        
        Args:
            skill_selector: SkillSelector instance
            tool_pool: ToolPool instance
            max_skills: Maximum number of skills to execute per query
        """
        self.selector = skill_selector or SkillSelector()
        self.tool_pool = tool_pool or ToolPool()
        self.max_skills = max_skills
        
        # Ensure tools are loaded from skills
        self._ensure_tools_loaded()
    
    def _ensure_tools_loaded(self) -> None:
        """Load all tools from registered skills into the tool pool."""
        from ..skills.registry import SkillRegistry
        
        registry = SkillRegistry()
        skills = registry.get_all_skills()
        
        for skill in skills:
            self.tool_pool.register_from_skill(skill)
            logger.debug(f"Loaded {len(skill.tools)} tools from skill '{skill.name}'")
    
    async def execute(
        self,
        query: str,
        context: Optional[Dict[str, Any]] = None,
        stream: bool = False
    ) -> Dict[str, Any]:
        """Execute appropriate skills for a query.
        
        Args:
            query: User query string
            context: Optional context dict with additional information
            stream: Whether to stream results
            
        Returns:
            Execution results with combined output
        """
        context = context or {}
        
        # 1. Select relevant skills
        selected_skills = self.selector.select(query, top_k=self.max_skills)
        
        if not selected_skills:
            logger.warning(f"No skills selected for query: {query[:100]}")
            return {
                "success": False,
                "error": "No relevant skills found for this query",
                "skills_executed": [],
                "results": []
            }
        
        logger.info(f"Selected skills: {[s.name for s in selected_skills]}")
        
        # 2. Order skills based on dependencies
        ordered_skills = self._order_skills(selected_skills)
        
        # 3. Get tools for each skill
        all_tools = []
        for skill in ordered_skills:
            tools = self.tool_pool.get_for_skill(skill.name)
            all_tools.extend(tools)
        
        # 4. Return execution plan
        return {
            "success": True,
            "skills": [s.name for s in ordered_skills],
            "tools": [getattr(t, '__name__', str(t)) for t in all_tools],
            "skill_metadata": [s.to_dict() for s in ordered_skills]
        }
    
    def _order_skills(self, skills: List[Skill]) -> List[Skill]:
        """Order skills based on dependencies.
        
        Ensures dependencies are executed before dependent skills.
        
        Args:
            skills: List of skills to order
            
        Returns:
            Ordered list of skills
        """
        skill_map = {s.name: s for s in skills}
        ordered = []
        added = set()
        
        def add_skill(skill: Skill):
            if skill.name in added:
                return
            
            # First add dependencies
            deps = self.SKILL_DEPENDENCIES.get(skill.name, [])
            for dep_name in deps:
                if dep_name in skill_map:
                    add_skill(skill_map[dep_name])
            
            # Then add this skill
            ordered.append(skill)
            added.add(skill.name)
        
        for skill in skills:
            add_skill(skill)
        
        return ordered
    
    def get_tools_for_query(self, query: str, max_tools: int = 10) -> List[Callable]:
        """Get all relevant tools for a query across selected skills.
        
        Args:
            query: User query string
            max_tools: Maximum number of tools to return
            
        Returns:
            List of tool functions
        """
        # Select skills
        skills = self.selector.select(query, top_k=self.max_skills)
        
        # Collect tools from each skill
        all_tools = []
        tool_names = set()
        
        for skill in skills:
            tools = self.tool_pool.get_for_skill(skill.name)
            for tool in tools:
                name = getattr(tool, '__name__', str(tool))
                if name not in tool_names:
                    all_tools.append(tool)
                    tool_names.add(name)
        
        # If we don't have enough, try query-based selection
        if len(all_tools) < max_tools:
            query_tools = self.tool_pool.get_for_query(query, top_k=max_tools)
            for tool in query_tools:
                name = getattr(tool, '__name__', str(tool))
                if name not in tool_names:
                    all_tools.append(tool)
                    tool_names.add(name)
        
        return all_tools[:max_tools]
    
    def explain_selection(self, query: str) -> Dict[str, Any]:
        """Explain which skills were selected and why.
        
        Args:
            query: User query string
            
        Returns:
            Explanation of skill selection
        """
        selections = self.selector.select_with_reasoning(query, top_k=self.max_skills)
        
        return {
            "query": query,
            "selected_skills": [
                {
                    "name": s["skill"].name,
                    "confidence": s["confidence"],
                    "reasoning": s["reasoning"],
                    "tools_available": len(s["skill"].tools)
                }
                for s in selections
            ],
            "execution_order": [
                s["skill"].name for s in selections
            ]
        }
