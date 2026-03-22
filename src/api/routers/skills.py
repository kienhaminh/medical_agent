"""Enhanced API router for skills with full CRUD and dynamic registration."""

from typing import List, Dict, Any, Optional
from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from src.config.database import AsyncSessionLocal
from src.models.skill import Skill as SkillModel, SkillTool as SkillToolModel
from src.skills.registry import SkillRegistry
from src.skills.base import Skill, SkillMetadata
from src.agent.skill_selector import SkillSelector
from src.agent.skill_orchestrator import SkillOrchestrator
from src.tools.pool import ToolPool

router = APIRouter(tags=["Skills"])


# Enhanced Request/Response models
class SkillCreateRequest(BaseModel):
    """Request model for creating a skill."""
    name: str = Field(..., description="Unique skill name")
    description: str = Field(..., description="Skill description")
    when_to_use: List[str] = Field(default_factory=list)
    when_not_to_use: List[str] = Field(default_factory=list)
    keywords: List[str] = Field(default_factory=list)
    examples: List[str] = Field(default_factory=list)
    source_type: str = Field(default="database", description="filesystem, database, plugin, external")


class SkillUpdateRequest(BaseModel):
    """Request model for updating a skill."""
    description: Optional[str] = None
    when_to_use: Optional[List[str]] = None
    when_not_to_use: Optional[List[str]] = None
    keywords: Optional[List[str]] = None
    examples: Optional[List[str]] = None
    enabled: Optional[bool] = None


class ToolCreateRequest(BaseModel):
    """Request model for creating a tool."""
    name: str = Field(..., description="Unique tool name within the skill")
    description: str = Field(..., description="Tool description")
    implementation_type: str = Field(default="code", description="code, config, api, composite")
    code: Optional[str] = Field(None, description="Python code for code-based tools")
    config: Optional[Dict[str, Any]] = Field(None, description="Configuration for config-based tools")
    parameters_schema: Optional[Dict[str, Any]] = Field(None, description="JSON schema for parameters")
    enabled: bool = Field(default=True)


class ToolUpdateRequest(BaseModel):
    """Request model for updating a tool."""
    description: Optional[str] = None
    code: Optional[str] = None
    config: Optional[Dict[str, Any]] = None
    parameters_schema: Optional[Dict[str, Any]] = None
    enabled: Optional[bool] = None


class SkillInfo(BaseModel):
    """Skill information response model."""
    id: Optional[int] = None
    name: str
    description: str
    when_to_use: List[str]
    when_not_to_use: List[str]
    keywords: List[str]
    examples: List[str]
    source_type: str
    enabled: bool
    version: str
    is_system: bool
    tool_count: int
    created_at: Optional[str] = None
    updated_at: Optional[str] = None


class ToolInfo(BaseModel):
    """Tool information response model."""
    id: Optional[int] = None
    skill_id: int
    skill_name: Optional[str] = None
    name: str
    description: str
    implementation_type: str
    config: Optional[Dict[str, Any]] = None
    parameters_schema: Optional[Dict[str, Any]] = None
    enabled: bool
    order: int


class SkillSelectionRequest(BaseModel):
    """Request model for skill selection."""
    query: str
    top_k: int = 3


class ReloadRequest(BaseModel):
    """Request model for reloading skills."""
    skill_name: Optional[str] = None  # If None, reload all


# Dependency to get DB session
async def get_db():
    async with AsyncSessionLocal() as session:
        yield session


def get_skill_registry() -> SkillRegistry:
    """Get or create SkillRegistry singleton."""
    return SkillRegistry()


# ============================================================================
# Skill CRUD Operations
# ============================================================================

@router.get("/api/skills", response_model=List[SkillInfo])
async def list_skills(
    source_type: Optional[str] = None,
    enabled_only: bool = True,
    db: AsyncSession = Depends(get_db)
):
    """List all skills with optional filtering.
    
    Args:
        source_type: Filter by source type (filesystem, database, plugin, external)
        enabled_only: Only return enabled skills
        
    Returns:
        List of skill information
    """
    try:
        query = select(SkillModel)
        
        if enabled_only:
            query = query.where(SkillModel.enabled == True)
        
        if source_type:
            query = query.where(SkillModel.source_type == source_type)
        
        query = query.order_by(SkillModel.name)
        
        result = await db.execute(query)
        skills = result.scalars().all()
        
        return [skill.to_dict() for skill in skills]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error listing skills: {str(e)}")


@router.post("/api/skills", response_model=SkillInfo, status_code=201)
async def create_skill(
    request: SkillCreateRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db)
):
    """Create a new skill.
    
    This allows dynamic creation of skills without filesystem changes.
    
    Args:
        request: Skill creation data
        
    Returns:
        Created skill information
    """
    try:
        # Check if skill already exists
        result = await db.execute(
            select(SkillModel).where(SkillModel.name == request.name)
        )
        if result.scalar_one_or_none():
            raise HTTPException(status_code=409, detail=f"Skill '{request.name}' already exists")
        
        # Create skill in DB
        skill = SkillModel(
            name=request.name,
            description=request.description,
            when_to_use=request.when_to_use,
            when_not_to_use=request.when_not_to_use,
            keywords=request.keywords,
            examples=request.examples,
            source_type=request.source_type,
            enabled=True
        )
        
        db.add(skill)
        await db.commit()
        await db.refresh(skill)
        
        # Register in runtime registry
        registry = get_skill_registry()
        await registry.register_skill_from_db(skill)
        
        return skill.to_dict()
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error creating skill: {str(e)}")


@router.get("/api/skills/{name}", response_model=SkillInfo)
async def get_skill(
    name: str,
    db: AsyncSession = Depends(get_db)
):
    """Get detailed information about a specific skill.
    
    Args:
        name: Skill name
        
    Returns:
        Skill information
    """
    try:
        result = await db.execute(
            select(SkillModel).where(SkillModel.name == name)
        )
        skill = result.scalar_one_or_none()
        
        if not skill:
            raise HTTPException(status_code=404, detail=f"Skill '{name}' not found")
        
        return skill.to_dict()
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error getting skill: {str(e)}")


@router.patch("/api/skills/{name}", response_model=SkillInfo)
async def update_skill(
    name: str,
    request: SkillUpdateRequest,
    db: AsyncSession = Depends(get_db)
):
    """Update an existing skill.
    
    Args:
        name: Skill name
        request: Update data
        
    Returns:
        Updated skill information
    """
    try:
        result = await db.execute(
            select(SkillModel).where(SkillModel.name == name)
        )
        skill = result.scalar_one_or_none()
        
        if not skill:
            raise HTTPException(status_code=404, detail=f"Skill '{name}' not found")
        
        # Update fields
        if request.description is not None:
            skill.description = request.description
        if request.when_to_use is not None:
            skill.when_to_use = request.when_to_use
        if request.when_not_to_use is not None:
            skill.when_not_to_use = request.when_not_to_use
        if request.keywords is not None:
            skill.keywords = request.keywords
        if request.examples is not None:
            skill.examples = request.examples
        if request.enabled is not None:
            skill.enabled = request.enabled
        
        await db.commit()
        await db.refresh(skill)
        
        # Reload in runtime registry
        registry = get_skill_registry()
        await registry.register_skill_from_db(skill)
        
        return skill.to_dict()
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error updating skill: {str(e)}")


@router.delete("/api/skills/{name}")
async def delete_skill(
    name: str,
    db: AsyncSession = Depends(get_db)
):
    """Delete a skill.
    
    System skills cannot be deleted.
    
    Args:
        name: Skill name to delete
        
    Returns:
        Deletion confirmation
    """
    try:
        result = await db.execute(
            select(SkillModel).where(SkillModel.name == name)
        )
        skill = result.scalar_one_or_none()
        
        if not skill:
            raise HTTPException(status_code=404, detail=f"Skill '{name}' not found")
        
        if skill.is_system:
            raise HTTPException(status_code=403, detail=f"Cannot delete system skill '{name}'")
        
        await db.delete(skill)
        await db.commit()
        
        # Unregister from runtime
        registry = get_skill_registry()
        registry.unregister(name)
        
        return {"message": f"Skill '{name}' deleted successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error deleting skill: {str(e)}")


# ============================================================================
# Tool CRUD Operations
# ============================================================================

@router.get("/api/skills/{name}/tools", response_model=List[ToolInfo])
async def get_skill_tools(
    name: str,
    db: AsyncSession = Depends(get_db)
):
    """Get tools for a specific skill.
    
    Args:
        name: Skill name
        
    Returns:
        List of tools
    """
    try:
        result = await db.execute(
            select(SkillModel).where(SkillModel.name == name)
        )
        skill = result.scalar_one_or_none()
        
        if not skill:
            raise HTTPException(status_code=404, detail=f"Skill '{name}' not found")
        
        return [tool.to_dict() for tool in skill.tools]
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error getting tools: {str(e)}")


@router.post("/api/skills/{name}/tools", response_model=ToolInfo, status_code=201)
async def add_tool_to_skill(
    name: str,
    request: ToolCreateRequest,
    db: AsyncSession = Depends(get_db)
):
    """Add a tool to a skill.
    
    Supports both code-based and config-based tools.
    
    Args:
        name: Skill name
        request: Tool creation data
        
    Returns:
        Created tool information
    """
    try:
        result = await db.execute(
            select(SkillModel).where(SkillModel.name == name)
        )
        skill = result.scalar_one_or_none()
        
        if not skill:
            raise HTTPException(status_code=404, detail=f"Skill '{name}' not found")
        
        # Check for duplicate tool name
        existing = next((t for t in skill.tools if t.name == request.name), None)
        if existing:
            raise HTTPException(
                status_code=409, 
                detail=f"Tool '{request.name}' already exists in skill '{name}'"
            )
        
        # Validate based on implementation type
        if request.implementation_type == "code" and not request.code:
            raise HTTPException(status_code=400, detail="Code is required for code-based tools")
        
        if request.implementation_type in ["config", "api"] and not request.config:
            raise HTTPException(status_code=400, detail="Config is required for config-based tools")
        
        # Create tool
        tool = SkillToolModel(
            skill_id=skill.id,
            name=request.name,
            description=request.description,
            implementation_type=request.implementation_type,
            code=request.code,
            config=request.config,
            parameters_schema=request.parameters_schema,
            enabled=request.enabled,
            order=len(skill.tools)  # Add to end
        )
        
        db.add(tool)
        await db.commit()
        await db.refresh(tool)
        
        # Register in runtime
        registry = get_skill_registry()
        await registry.register_skill_from_db(skill)
        
        return tool.to_dict()
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error creating tool: {str(e)}")


@router.patch("/api/skills/{name}/tools/{tool_name}", response_model=ToolInfo)
async def update_tool(
    name: str,
    tool_name: str,
    request: ToolUpdateRequest,
    db: AsyncSession = Depends(get_db)
):
    """Update a tool in a skill.
    
    Args:
        name: Skill name
        tool_name: Tool name
        request: Update data
        
    Returns:
        Updated tool information
    """
    try:
        result = await db.execute(
            select(SkillModel).where(SkillModel.name == name)
        )
        skill = result.scalar_one_or_none()
        
        if not skill:
            raise HTTPException(status_code=404, detail=f"Skill '{name}' not found")
        
        tool = next((t for t in skill.tools if t.name == tool_name), None)
        if not tool:
            raise HTTPException(
                status_code=404,
                detail=f"Tool '{tool_name}' not found in skill '{name}'"
            )
        
        # Update fields
        if request.description is not None:
            tool.description = request.description
        if request.code is not None:
            tool.code = request.code
        if request.config is not None:
            tool.config = request.config
        if request.parameters_schema is not None:
            tool.parameters_schema = request.parameters_schema
        if request.enabled is not None:
            tool.enabled = request.enabled
        
        await db.commit()
        await db.refresh(tool)
        
        # Reload in runtime
        registry = get_skill_registry()
        await registry.register_skill_from_db(skill)
        
        return tool.to_dict()
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error updating tool: {str(e)}")


@router.delete("/api/skills/{name}/tools/{tool_name}")
async def delete_tool(
    name: str,
    tool_name: str,
    db: AsyncSession = Depends(get_db)
):
    """Delete a tool from a skill.
    
    Args:
        name: Skill name
        tool_name: Tool name
        
    Returns:
        Deletion confirmation
    """
    try:
        result = await db.execute(
            select(SkillModel).where(SkillModel.name == name)
        )
        skill = result.scalar_one_or_none()
        
        if not skill:
            raise HTTPException(status_code=404, detail=f"Skill '{name}' not found")
        
        tool = next((t for t in skill.tools if t.name == tool_name), None)
        if not tool:
            raise HTTPException(
                status_code=404,
                detail=f"Tool '{tool_name}' not found in skill '{name}'"
            )
        
        await db.delete(tool)
        await db.commit()
        
        # Reload in runtime
        registry = get_skill_registry()
        await registry.register_skill_from_db(skill)
        
        return {"message": f"Tool '{tool_name}' deleted from skill '{name}'"}
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error deleting tool: {str(e)}")


# ============================================================================
# Skill Selection and Execution
# ============================================================================

@router.post("/api/skills/select", response_model=Dict[str, Any])
async def select_skills(request: SkillSelectionRequest):
    """Select appropriate skills for a query."""
    try:
        selector = SkillSelector()
        selections = selector.select_with_reasoning(request.query, top_k=request.top_k)
        
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


@router.post("/api/skills/execute")
async def execute_skills(request: SkillSelectionRequest):
    """Execute appropriate skills for a query."""
    try:
        orchestrator = SkillOrchestrator()
        result = await orchestrator.execute(query=request.query)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error executing skills: {str(e)}")


# ============================================================================
# Hot Reload Operations
# ============================================================================

@router.post("/api/skills/reload")
async def reload_skills(
    request: Optional[ReloadRequest] = None,
    db: AsyncSession = Depends(get_db)
):
    """Reload skills from database and filesystem.
    
    If skill_name is provided, reload only that skill.
    Otherwise, check all filesystem skills for changes and reload as needed.
    
    Args:
        request: Optional reload request with specific skill name
        
    Returns:
        Reload results
    """
    try:
        registry = get_skill_registry()
        
        if request and request.skill_name:
            # Reload specific skill
            skill = await registry.reload_skill(request.skill_name)
            if skill:
                return {
                    "reloaded": [request.skill_name],
                    "message": f"Skill '{request.skill_name}' reloaded successfully"
                }
            else:
                raise HTTPException(
                    status_code=404,
                    detail=f"Skill '{request.skill_name}' not found or could not be reloaded"
                )
        else:
            # Auto-reload changed skills
            count = await registry.auto_reload()
            
            # Also reload from database
            db_count = await registry.load_from_database()
            
            return {
                "filesystem_reloaded": count,
                "database_loaded": db_count,
                "message": f"Reloaded {count} changed skills from filesystem, loaded {db_count} from database"
            }
            
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error reloading skills: {str(e)}")


@router.get("/api/skills/check-changes")
async def check_skill_changes():
    """Check which filesystem-based skills have changes.
    
    Returns:
        List of skill names that have been modified
    """
    try:
        registry = get_skill_registry()
        changed = await registry.check_for_changes()
        
        return {
            "changed_skills": changed,
            "count": len(changed)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error checking changes: {str(e)}")


# ============================================================================
# Plugin/External Skill Discovery
# ============================================================================

@router.post("/api/skills/discover")
async def discover_skills(
    paths: List[str],
    recursive: bool = False,
    db: AsyncSession = Depends(get_db)
):
    """Discover skills from filesystem paths.
    
    This allows adding skills from custom directories (plugins, external).
    
    Args:
        paths: List of directory paths to search
        recursive: Whether to search recursively
        
    Returns:
        Discovery results
    """
    try:
        registry = get_skill_registry()
        count = registry.discover_skills(paths, recursive=recursive)
        
        # Save discovered skills to database
        for skill in registry.get_all_skills():
            source = registry.get_skill_source(skill.name)
            if source and source.type == "filesystem":
                try:
                    await registry.save_to_database(skill, source_type="filesystem")
                except Exception as e:
                    print(f"[WARN] Failed to save skill '{skill.name}' to DB: {e}")
        
        return {
            "discovered": count,
            "paths": paths,
            "message": f"Discovered {count} skills from {len(paths)} paths"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error discovering skills: {str(e)}")
