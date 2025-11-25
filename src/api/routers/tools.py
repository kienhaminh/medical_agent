from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from ...config.database import get_db, Tool
from ..models import ToolResponse, ToolCreate, ToolUpdate

router = APIRouter()

@router.get("/api/tools", response_model=list[ToolResponse])
async def list_tools(db: AsyncSession = Depends(get_db)):
    """List all tools and their status from database."""
    result = await db.execute(select(Tool).order_by(Tool.name))
    tools = result.scalars().all()

    return [
        ToolResponse(
            name=tool.name,
            symbol=tool.symbol,
            description=tool.description,
            tool_type=tool.tool_type,
            code=tool.code,
            api_endpoint=tool.api_endpoint,
            api_request_payload=tool.api_request_payload,
            api_response_payload=tool.api_response_payload,
            scope=tool.scope,
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

    # Check if symbol already exists
    result = await db.execute(select(Tool).where(Tool.symbol == tool_data.symbol))
    existing_symbol = result.scalar_one_or_none()

    if existing_symbol:
        raise HTTPException(status_code=400, detail=f"Tool symbol '{tool_data.symbol}' already exists")

    # Create new tool
    new_tool = Tool(
        name=tool_data.name,
        symbol=tool_data.symbol,
        description=tool_data.description,
        tool_type=tool_data.tool_type,
        code=tool_data.code,
        api_endpoint=tool_data.api_endpoint,
        api_request_payload=tool_data.api_request_payload,
        api_response_payload=tool_data.api_response_payload,
        scope=tool_data.scope
    )

    db.add(new_tool)
    await db.commit()
    await db.refresh(new_tool)

    return ToolResponse(
        name=new_tool.name,
        symbol=new_tool.symbol,
        description=new_tool.description,
        tool_type=new_tool.tool_type,
        code=new_tool.code,
        api_endpoint=new_tool.api_endpoint,
        api_request_payload=new_tool.api_request_payload,
        api_response_payload=new_tool.api_response_payload,
        scope=new_tool.scope,
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
    if tool_data.tool_type is not None:
        tool.tool_type = tool_data.tool_type
    if tool_data.code is not None:
        tool.code = tool_data.code
    if tool_data.api_endpoint is not None:
        tool.api_endpoint = tool_data.api_endpoint
    if tool_data.api_request_payload is not None:
        tool.api_request_payload = tool_data.api_request_payload
    if tool_data.api_response_payload is not None:
        tool.api_response_payload = tool_data.api_response_payload

    await db.commit()
    await db.refresh(tool)

    return ToolResponse(
        name=tool.name,
        symbol=tool.symbol,
        description=tool.description,
        tool_type=tool.tool_type,
        code=tool.code,
        api_endpoint=tool.api_endpoint,
        api_request_payload=tool.api_request_payload,
        api_response_payload=tool.api_response_payload,
        scope=tool.scope,
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
