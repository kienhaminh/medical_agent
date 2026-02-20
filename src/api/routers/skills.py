"""API router for skills endpoints."""

from typing import List, Dict, Any, Optional
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel

from src.skills.registry import SkillRegistry
from src.skills.base import Skill
from src.agent.skill_selector import SkillSelector
from src.agent.skill_orchestrator import SkillOrchestrator

router = APIRouter()


# Request/Response models
class SkillInfo(BaseModel):
    """Skill information response model."""
    name: str
    description: str
    when_to_use: List[str]
    when_not_to_use: List[str]
    keywords: List[str]
    tools: List[str]
    tool_count: int


class SkillSelectionRequest(BaseModel):
    """Request model for skill selection."""
    query: str
    top_k: int = 3


class SkillSelectionResponse(BaseModel):
    """Response model for skill selection."""
    query: str
    selected_skills: List[Dict[str, Any]]


class SkillExecuteRequest(BaseModel):
    """Request model for skill execution."""
    query: str
    context: Optional[Dict[str, Any]] = None


class SkillExecuteResponse(BaseModel):
    """Response model for skill execution."""
    success: bool
    skills: List[str]
    tools: List[str]
    error: Optional[str] = None


def get_skill_registry() -> SkillRegistry:
    """Get or create SkillRegistry singleton."""
    registry = SkillRegistry()
    
    # Ensure skills are discovered
    if not registry.get_all_skills():
        import os
        skills_dir = os.path.join(
            os.path.dirname(os.path.dirname(os.path.dirname(__file__))),
            "skills"
        )
        registry.discover_skills(skills_dir)
    
    return registry


@router.get("/api/skills", response_model=List[SkillInfo])
async def list_skills(registry: SkillRegistry = Depends(get_skill_registry)):
    """List all available skills.
    
    Returns:
        List of skill information
    """
    try:
        skills = registry.list_skills()
        return skills
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error listing skills: {str(e)}")


@router.get("/api/skills/{name}", response_model=SkillInfo)
async def get_skill(
    name: str,
    registry: SkillRegistry = Depends(get_skill_registry)
):
    """Get detailed information about a specific skill.
    
    Args:
        name: Skill name
        
    Returns:
        Skill information
    """
    try:
        skill = registry.get(name)
        if not skill:
            raise HTTPException(status_code=404, detail=f"Skill '{name}' not found")
        
        return skill.to_dict()
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error getting skill: {str(e)}")


@router.post("/api/skills/select", response_model=SkillSelectionResponse)
async def select_skills(request: SkillSelectionRequest):
    """Select appropriate skills for a query.
    
    This endpoint analyzes the query and returns the most relevant skills.
    
    Args:
        request: Selection request with query
        
    Returns:
        Selected skills with confidence scores
    """
    try:
        selector = SkillSelector()
        selections = selector.select_with_reasoning(
            request.query,
            top_k=request.top_k
        )
        
        return {
            "query": request.query,
            "selected_skills": [
                {
                    "name": s["skill"].name,
                    "description": s["skill"].description,
                    "confidence": s["confidence"],
                    "reasoning": s["reasoning"]
                }
                for s in selections
            ]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error selecting skills: {str(e)}")


@router.post("/api/skills/execute", response_model=SkillExecuteResponse)
async def execute_skills(request: SkillExecuteRequest):
    """Execute appropriate skills for a query.
    
    This endpoint selects and executes the relevant skills for the given query.
    
    Args:
        request: Execution request with query and optional context
        
    Returns:
        Execution results
    """
    try:
        orchestrator = SkillOrchestrator()
        result = await orchestrator.execute(
            query=request.query,
            context=request.context or {}
        )
        
        return {
            "success": result.get("success", False),
            "skills": result.get("skills", []),
            "tools": result.get("tools", []),
            "error": result.get("error")
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error executing skills: {str(e)}")


@router.post("/api/skills/{name}/execute")
async def execute_single_skill(
    name: str,
    request: SkillExecuteRequest,
    registry: SkillRegistry = Depends(get_skill_registry)
):
    """Execute a specific skill.
    
    Args:
        name: Skill name to execute
        request: Execution request
        
    Returns:
        Execution results
    """
    try:
        skill = registry.get(name)
        if not skill:
            raise HTTPException(status_code=404, detail=f"Skill '{name}' not found")
        
        # Get tools for this skill
        tools = []
        for tool_name in skill.list_tools():
            tool_info = {
                "name": tool_name,
                "description": skill.get_tool(tool_name).__doc__ or ""
            }
            tools.append(tool_info)
        
        return {
            "success": True,
            "skill": name,
            "query": request.query,
            "available_tools": tools,
            "message": f"Skill '{name}' is ready to execute. Use the tools through the chat API."
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error executing skill: {str(e)}")


@router.get("/api/skills/{name}/tools")
async def get_skill_tools(
    name: str,
    registry: SkillRegistry = Depends(get_skill_registry)
):
    """Get tools available in a specific skill.
    
    Args:
        name: Skill name
        
    Returns:
        List of tools in the skill
    """
    try:
        skill = registry.get(name)
        if not skill:
            raise HTTPException(status_code=404, detail=f"Skill '{name}' not found")
        
        tools = []
        for tool_name in skill.list_tools():
            func = skill.get_tool(tool_name)
            tools.append({
                "name": tool_name,
                "description": func.__doc__[:200] + "..." if func.__doc__ and len(func.__doc__) > 200 else (func.__doc__ or "")
            })
        
        return {
            "skill": name,
            "tools": tools
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error getting tools: {str(e)}")
