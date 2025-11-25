"""
Migration script to remove Internist agent and its tools from the database.
This is part of the transition to making Internist a pure codebase-defined core agent.
"""
import asyncio
import sys
import os
from dotenv import load_dotenv
from sqlalchemy import select, delete, text

# Load environment variables
load_dotenv()

# Add project root to python path
sys.path.append(os.getcwd())

from src.config.database import AsyncSessionLocal, SubAgent, Tool, ChatSession, engine

async def clean_internist_from_db():
    print("Removing Internist agent and tools from database...")
    
    async with AsyncSessionLocal() as session:
        # 1. Find Internist agent
        result = await session.execute(
            select(SubAgent).where(
                (SubAgent.role == "clinical_text") | 
                (SubAgent.name == "Internist")
            )
        )
        internist = result.scalar_one_or_none()
        
        if not internist:
            print("  ✓ Internist agent already removed or not found.")
        else:
            print(f"  Found Internist agent (ID: {internist.id})")
            
            # 2. Update ChatSessions to remove reference to this agent
            # Since we are deleting the agent, we need to set agent_id to NULL in chat sessions
            # to avoid foreign key violation (if cascade isn't set) or data loss (if cascade deletes sessions).
            # We want to keep sessions but just unlink the agent.
            print("  Unlinking chat sessions...")
            await session.execute(
                text("UPDATE chat_sessions SET agent_id = NULL WHERE agent_id = :agent_id"),
                {"agent_id": internist.id}
            )
            
            # 3. Delete assigned tools
            # Specifically delete 'query_patient_info' tool
            print("  Deleting 'query_patient_info' tool...")
            await session.execute(
                delete(Tool).where(Tool.symbol == "query_patient_info")
            )
            
            # Delete other tools assigned to this agent (if any)
            print(f"  Deleting other tools assigned to agent {internist.id}...")
            await session.execute(
                delete(Tool).where(Tool.assigned_agent_id == internist.id)
            )
            
            # 4. Delete the agent
            print(f"  Deleting Internist agent...")
            await session.delete(internist)
            
            await session.commit()
            print("  ✓ Internist agent and tools removed successfully.")

    # Double check tool deletion by symbol just in case it wasn't assigned or found above
    async with AsyncSessionLocal() as session:
        result = await session.execute(
            select(Tool).where(Tool.symbol == "query_patient_info")
        )
        tool = result.scalar_one_or_none()
        if tool:
            print("  Found lingering 'query_patient_info' tool. Deleting...")
            await session.delete(tool)
            await session.commit()
            print("  ✓ Tool deleted.")
        else:
            print("  ✓ 'query_patient_info' tool verified removed.")

    print("Migration complete.")

if __name__ == "__main__":
    asyncio.run(clean_internist_from_db())
