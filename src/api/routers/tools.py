from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from ...config.database import get_db, Tool
from ..models import ToolResponse, ToolToggleRequest, ToolCreate, ToolUpdate
from ..dependencies import tool_registry

router = APIRouter()

@router.get("/api/tools", response_model=list[ToolResponse])
async def list_tools(db: AsyncSession = Depends(get_db)):
    """List all tools and their status from database."""
    result = await db.execute(select(Tool).order_by(Tool.name))
    tools = result.scalars().all()
    
    return [
        ToolResponse(
            name=tool.name,
            description=tool.description,
            enabled=tool.enabled,
            scope=tool.scope,
            category=tool.category,
            assigned_agent_id=tool.assigned_agent_id
        ) for tool in tools
    ]

@router.post("/api/tools", response_model=ToolResponse)
async def create_tool(tool_data: ToolCreate, db: AsyncSession = Depends(get_db)):
    """Create a new tool."""
    # Check if tool already exists
    result = await db.execute(select(Tool).where(Tool.name == tool_data.name))
    existing_tool = result.scalar_one_or_none()
    
    if existing_tool:
        raise HTTPException(status_code=400, detail=f"Tool '{tool_data.name}' already exists")
    
    # Create new tool
    new_tool = Tool(
        name=tool_data.name,
        description=tool_data.description,
        code=tool_data.code,
        enabled=True,
        scope=tool_data.scope,
        category=tool_data.category
    )
    
    db.add(new_tool)
    await db.commit()
    await db.refresh(new_tool)
    
    return ToolResponse(
        name=new_tool.name,
        description=new_tool.description,
        enabled=new_tool.enabled,
        scope=new_tool.scope,
        category=new_tool.category,
        assigned_agent_id=new_tool.assigned_agent_id
    )

@router.put("/api/tools/{name}", response_model=ToolResponse)
async def update_tool(name: str, tool_data: ToolUpdate, db: AsyncSession = Depends(get_db)):
    """Update an existing tool."""
    result = await db.execute(select(Tool).where(Tool.name == name))
    tool = result.scalar_one_or_none()
    
    if not tool:
        raise HTTPException(status_code=404, detail=f"Tool '{name}' not found")
    
    # Update fields if provided
    if tool_data.description is not None:
        tool.description = tool_data.description
    if tool_data.category is not None:
        tool.category = tool_data.category
    if tool_data.code is not None:
        tool.code = tool_data.code
    if tool_data.enabled is not None:
        tool.enabled = tool_data.enabled
    
    await db.commit()
    await db.refresh(tool)
    
    return ToolResponse(
        name=tool.name,
        description=tool.description,
        enabled=tool.enabled,
        scope=tool.scope,
        category=tool.category,
        assigned_agent_id=tool.assigned_agent_id
    )

@router.delete("/api/tools/{name}")
async def delete_tool(name: str, db: AsyncSession = Depends(get_db)):
    """Delete a tool and its assignments."""
    result = await db.execute(select(Tool).where(Tool.name == name))
    tool = result.scalar_one_or_none()
    
    if not tool:
        raise HTTPException(status_code=404, detail=f"Tool '{name}' not found")
    
    await db.delete(tool)
    await db.commit()
    
    return {"message": f"Tool '{name}' deleted successfully"}

@router.post("/api/tools/{name}/toggle")
async def toggle_tool(name: str, request: ToolToggleRequest):
    """Enable or disable a tool."""
    if request.enabled:
        tool_registry.enable_tool(name)
    else:
        tool_registry.disable_tool(name)
    return {"name": name, "enabled": tool_registry.is_tool_enabled(name)}
