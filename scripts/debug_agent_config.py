"""Debug script to check agent and tool configuration."""

import asyncio
import sys
sys.path.insert(0, '/Users/kien.ha/Code/ai-agent')

from src.config.database import AsyncSessionLocal, SubAgent, AgentToolAssignment, Tool
from sqlalchemy import select

async def check_config():
    async with AsyncSessionLocal() as db:
        # Check enabled sub-agents
        result = await db.execute(select(SubAgent).where(SubAgent.enabled == True))
        agents = result.scalars().all()
        print('\n=== ENABLED SUB-AGENTS ===')
        for agent in agents:
            print(f'ID: {agent.id}, Name: {agent.name}, Role: {agent.role}')
        
        # Check patient tool
        result = await db.execute(select(Tool).where(Tool.name == 'query_patient_info'))
        tool = result.scalar_one_or_none()
        if tool:
            print(f'\n=== PATIENT TOOL ===')
            print(f'Name: {tool.name}')
            print(f'Enabled: {tool.enabled}')
            print(f'Scope: {tool.scope}')
        else:
            print('\n=== PATIENT TOOL NOT FOUND ===')
        
        # Check tool assignments
        if agents:
            for agent in agents:
                result = await db.execute(
                    select(Tool)
                    .join(AgentToolAssignment)
                    .where(
                        AgentToolAssignment.agent_id == agent.id,
                        AgentToolAssignment.enabled == True
                    )
                )
                tools = result.scalars().all()
                print(f'\n=== TOOLS FOR {agent.name} ({agent.role}) ===')
                for tool in tools:
                    print(f'  - {tool.name} (scope: {tool.scope})')
        
        if not agents:
            print('\n⚠️ NO ENABLED SUB-AGENTS FOUND! This is the problem!')

if __name__ == "__main__":
    asyncio.run(check_config())
