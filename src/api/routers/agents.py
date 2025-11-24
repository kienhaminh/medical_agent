from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete, update

from ...config.database import get_db, SubAgent, Tool
from ..models import (
    SubAgentResponse, SubAgentCreate, SubAgentUpdate, ToggleRequest,
    ToolResponse, AssignToolRequest, AgentToolAssignmentResponse, BulkToolsRequest
)

router = APIRouter()

@router.get("/api/agents", response_model=list[SubAgentResponse])
async def list_agents(db: AsyncSession = Depends(get_db)):
    """List all sub-agents."""
    result = await db.execute(select(SubAgent).order_by(SubAgent.created_at.desc()))
    agents = result.scalars().all()
    return [
        SubAgentResponse(
            id=agent.id,
            name=agent.name,
            role=agent.role,
            description=agent.description,
            system_prompt=agent.system_prompt,
            enabled=agent.enabled,
            color=agent.color,
            icon=agent.icon,
            is_template=agent.is_template,
            parent_template_id=agent.parent_template_id,
            created_at=agent.created_at.isoformat(),
            updated_at=agent.updated_at.isoformat()
        ) for agent in agents
    ]

@router.post("/api/agents", response_model=SubAgentResponse)
async def create_agent(agent_data: SubAgentCreate, db: AsyncSession = Depends(get_db)):
    """Create a new sub-agent."""
    # Check if agent with same name exists
    result = await db.execute(select(SubAgent).where(SubAgent.name == agent_data.name))
    existing = result.scalar_one_or_none()
    if existing:
        raise HTTPException(status_code=400, detail=f"Agent with name '{agent_data.name}' already exists")

    new_agent = SubAgent(
        name=agent_data.name,
        role=agent_data.role,
        description=agent_data.description,
        system_prompt=agent_data.system_prompt,
        color=agent_data.color,
        icon=agent_data.icon,
        is_template=agent_data.is_template,
        parent_template_id=agent_data.parent_template_id,
        enabled=True
    )
    db.add(new_agent)
    await db.commit()
    await db.refresh(new_agent)

    return SubAgentResponse(
        id=new_agent.id,
        name=new_agent.name,
        role=new_agent.role,
        description=new_agent.description,
        system_prompt=new_agent.system_prompt,
        enabled=new_agent.enabled,
        color=new_agent.color,
        icon=new_agent.icon,
        is_template=new_agent.is_template,
        parent_template_id=new_agent.parent_template_id,
        created_at=new_agent.created_at.isoformat(),
        updated_at=new_agent.updated_at.isoformat()
    )

@router.get("/api/agents/{agent_id}", response_model=SubAgentResponse)
async def get_agent(agent_id: int, db: AsyncSession = Depends(get_db)):
    """Get a specific sub-agent."""
    result = await db.execute(select(SubAgent).where(SubAgent.id == agent_id))
    agent = result.scalar_one_or_none()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")

    return SubAgentResponse(
        id=agent.id,
        name=agent.name,
        role=agent.role,
        description=agent.description,
        system_prompt=agent.system_prompt,
        enabled=agent.enabled,
        color=agent.color,
        icon=agent.icon,
        is_template=agent.is_template,
        parent_template_id=agent.parent_template_id,
        created_at=agent.created_at.isoformat(),
        updated_at=agent.updated_at.isoformat()
    )

@router.put("/api/agents/{agent_id}", response_model=SubAgentResponse)
async def update_agent(agent_id: int, agent_data: SubAgentUpdate, db: AsyncSession = Depends(get_db)):
    """Update a sub-agent."""
    result = await db.execute(select(SubAgent).where(SubAgent.id == agent_id))
    agent = result.scalar_one_or_none()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")

    # Update fields
    if agent_data.name is not None:
        # Check for name conflicts
        result = await db.execute(
            select(SubAgent).where(SubAgent.name == agent_data.name, SubAgent.id != agent_id)
        )
        if result.scalar_one_or_none():
            raise HTTPException(status_code=400, detail=f"Agent with name '{agent_data.name}' already exists")
        agent.name = agent_data.name

    if agent_data.role is not None:
        agent.role = agent_data.role
    if agent_data.description is not None:
        agent.description = agent_data.description
    if agent_data.system_prompt is not None:
        agent.system_prompt = agent_data.system_prompt
    if agent_data.color is not None:
        agent.color = agent_data.color
    if agent_data.icon is not None:
        agent.icon = agent_data.icon
    if agent_data.enabled is not None:
        agent.enabled = agent_data.enabled

    await db.commit()
    await db.refresh(agent)

    return SubAgentResponse(
        id=agent.id,
        name=agent.name,
        role=agent.role,
        description=agent.description,
        system_prompt=agent.system_prompt,
        enabled=agent.enabled,
        color=agent.color,
        icon=agent.icon,
        is_template=agent.is_template,
        parent_template_id=agent.parent_template_id,
        created_at=agent.created_at.isoformat(),
        updated_at=agent.updated_at.isoformat()
    )

@router.delete("/api/agents/{agent_id}")
async def delete_agent(agent_id: int, db: AsyncSession = Depends(get_db)):
    """Delete a sub-agent and its tool assignments."""
    result = await db.execute(select(SubAgent).where(SubAgent.id == agent_id))
    agent = result.scalar_one_or_none()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")

    await db.delete(agent)
    await db.commit()
    return {"status": "ok", "message": f"Agent '{agent.name}' deleted successfully"}

@router.post("/api/agents/{agent_id}/toggle", response_model=SubAgentResponse)
async def toggle_agent(agent_id: int, request: ToggleRequest, db: AsyncSession = Depends(get_db)):
    """Enable or disable a sub-agent."""
    result = await db.execute(select(SubAgent).where(SubAgent.id == agent_id))
    agent = result.scalar_one_or_none()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")

    agent.enabled = request.enabled
    await db.commit()
    await db.refresh(agent)

    return SubAgentResponse(
        id=agent.id,
        name=agent.name,
        role=agent.role,
        description=agent.description,
        system_prompt=agent.system_prompt,
        enabled=agent.enabled,
        color=agent.color,
        icon=agent.icon,
        is_template=agent.is_template,
        parent_template_id=agent.parent_template_id,
        created_at=agent.created_at.isoformat(),
        updated_at=agent.updated_at.isoformat()
    )

@router.post("/api/agents/{agent_id}/clone", response_model=SubAgentResponse)
async def clone_agent(agent_id: int, db: AsyncSession = Depends(get_db)):
    """Clone an existing agent (create a copy based on a template)."""
    result = await db.execute(select(SubAgent).where(SubAgent.id == agent_id))
    template_agent = result.scalar_one_or_none()
    if not template_agent:
        raise HTTPException(status_code=404, detail="Agent not found")

    # Generate unique name
    base_name = f"{template_agent.name} Copy"
    clone_name = base_name
    counter = 1
    while True:
        result = await db.execute(select(SubAgent).where(SubAgent.name == clone_name))
        if not result.scalar_one_or_none():
            break
        counter += 1
        clone_name = f"{base_name} {counter}"

    # Create clone
    cloned_agent = SubAgent(
        name=clone_name,
        role=template_agent.role,
        description=template_agent.description,
        system_prompt=template_agent.system_prompt,
        color=template_agent.color,
        icon=template_agent.icon,
        is_template=False,
        parent_template_id=agent_id,
        enabled=True
    )
    db.add(cloned_agent)
    await db.commit()
    await db.refresh(cloned_agent)

    # Note: Tool assignments are not copied because tools are unique 1:N resources.
    # The user must explicitly assign tools to the new agent (stealing them from others)
    # or create new tools for the clone.

    return SubAgentResponse(
        id=cloned_agent.id,
        name=cloned_agent.name,
        role=cloned_agent.role,
        description=cloned_agent.description,
        system_prompt=cloned_agent.system_prompt,
        enabled=cloned_agent.enabled,
        color=cloned_agent.color,
        icon=cloned_agent.icon,
        is_template=cloned_agent.is_template,
        parent_template_id=cloned_agent.parent_template_id,
        created_at=cloned_agent.created_at.isoformat(),
        updated_at=cloned_agent.updated_at.isoformat()
    )

# --- Tool Assignment Endpoints ---

@router.get("/api/agents/{agent_id}/tools", response_model=list[ToolResponse])
async def get_agent_tools(agent_id: int, db: AsyncSession = Depends(get_db)):
    """Get all tools assigned to an agent."""
    # Verify agent exists
    result = await db.execute(select(SubAgent).where(SubAgent.id == agent_id))
    agent = result.scalar_one_or_none()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")

    # Get assigned tools
    result = await db.execute(
        select(Tool).where(Tool.assigned_agent_id == agent_id)
    )
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

@router.post("/api/agents/{agent_id}/tools", response_model=AgentToolAssignmentResponse)
async def assign_tool_to_agent(agent_id: int, request: AssignToolRequest, db: AsyncSession = Depends(get_db)):
    """Assign a tool to an agent."""
    # Verify agent exists
    result = await db.execute(select(SubAgent).where(SubAgent.id == agent_id))
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Agent not found")

    # Verify tool exists
    result = await db.execute(select(Tool).where(Tool.name == request.tool_name))
    tool = result.scalar_one_or_none()
    if not tool:
        raise HTTPException(status_code=404, detail="Tool not found")

    # Check if assignment already exists
    if tool.assigned_agent_id == agent_id:
        raise HTTPException(status_code=400, detail="Tool already assigned to this agent")

    # Update assignment
    tool.assigned_agent_id = agent_id
    await db.commit()
    await db.refresh(tool)

    return AgentToolAssignmentResponse(
        agent_id=tool.assigned_agent_id,
        tool_name=tool.name
    )

@router.delete("/api/agents/{agent_id}/tools/{tool_name}")
async def unassign_tool_from_agent(agent_id: int, tool_name: str, db: AsyncSession = Depends(get_db)):
    """Remove a tool assignment from an agent."""
    result = await db.execute(select(Tool).where(Tool.name == tool_name))
    tool = result.scalar_one_or_none()
    
    if not tool:
        raise HTTPException(status_code=404, detail="Tool not found")
        
    if tool.assigned_agent_id != agent_id:
        raise HTTPException(status_code=404, detail="Tool is not assigned to this agent")

    tool.assigned_agent_id = None
    await db.commit()
    return {"status": "ok", "message": f"Tool '{tool_name}' unassigned from agent"}

@router.put("/api/agents/{agent_id}/tools", response_model=list[AgentToolAssignmentResponse])
async def bulk_update_agent_tools(agent_id: int, request: BulkToolsRequest, db: AsyncSession = Depends(get_db)):
    """Bulk update tool assignments for an agent (replaces all assignments)."""
    # Verify agent exists
    result = await db.execute(select(SubAgent).where(SubAgent.id == agent_id))
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Agent not found")

    # Unassign all currently assigned tools
    await db.execute(
        update(Tool)
        .where(Tool.assigned_agent_id == agent_id)
        .values(assigned_agent_id=None)
    )

    # Assign new tools
    if request.tool_names:
        await db.execute(
            update(Tool)
            .where(Tool.name.in_(request.tool_names))
            .values(assigned_agent_id=agent_id)
        )

    await db.commit()

    # Return new assignments
    # We need to fetch them to be sure
    result = await db.execute(
        select(Tool).where(Tool.assigned_agent_id == agent_id)
    )
    tools = result.scalars().all()

    return [
        AgentToolAssignmentResponse(
            agent_id=tool.assigned_agent_id,
            tool_name=tool.name
        ) for tool in tools
    ]

@router.get("/api/agent-tool-assignments")
async def get_all_assignments(db: AsyncSession = Depends(get_db)):
    """Get all agent-tool assignments (for matrix view)."""
    # Get assigned tools
    result = await db.execute(
        select(Tool)
        .where(Tool.assigned_agent_id.isnot(None))
        .join(SubAgent, Tool.assigned_agent_id == SubAgent.id)
    )
    tools = result.scalars().all()
    
    # Eager load or fetch agents? We can just join. 
    # Let's refetch agents to build the response context if needed, 
    # but we can probably just use the Tool's assigned_agent_id to lookup if we load all agents.
    
    agents_result = await db.execute(select(SubAgent))
    agents = {agent.id: agent for agent in agents_result.scalars().all()}

    # Return list of assignments
    assignments = []
    for tool in tools:
        if tool.assigned_agent_id not in agents:
            continue
            
        agent = agents[tool.assigned_agent_id]
        
        assignments.append({
            "id": 0, # Dummy ID as assignment entity is gone
            "agent": SubAgentResponse(
                id=agent.id,
                name=agent.name,
                role=agent.role,
                description=agent.description,
                system_prompt=agent.system_prompt,
                enabled=agent.enabled,
                color=agent.color,
                icon=agent.icon,
                is_template=agent.is_template,
                parent_template_id=agent.parent_template_id,
                created_at=agent.created_at.isoformat(),
                updated_at=agent.updated_at.isoformat()
            ),
            "tool": ToolResponse(
                name=tool.name,
                description=tool.description,
                enabled=tool.enabled,
                scope=tool.scope,
                category=tool.category,
                assigned_agent_id=tool.assigned_agent_id
            ),
            "enabled": tool.enabled, # Use tool's enabled status
            "created_at": tool.created_at.isoformat() # Use tool's created_at
        })

    return assignments
