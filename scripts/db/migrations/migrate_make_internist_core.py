"""
Migration script to convert Internist to a core sub-agent and assign the fixed patient tool.
"""
import asyncio
import sys
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Add project root to python path
sys.path.append(os.getcwd())

from sqlalchemy import select, update
from src.config.database import AsyncSessionLocal, SubAgent, Tool

async def migrate():
    print("Migrating Internist to core agent...")
    
    async with AsyncSessionLocal() as session:
        # 1. Find Internist agent
        result = await session.execute(
            select(SubAgent).where(SubAgent.role == "clinical_text")
        )
        internist = result.scalar_one_or_none()
        
        if not internist:
            # Try by name if role search failed
            result = await session.execute(
                select(SubAgent).where(SubAgent.name == "Internist")
            )
            internist = result.scalar_one_or_none()
            
        if not internist:
            print("Error: Internist agent not found in database.")
            return

        print(f"Found Internist agent (ID: {internist.id})")

        # 2. Update to core agent (is_template=False)
        if internist.is_template:
            internist.is_template = False
            print("  ✓ Set is_template = False")
        else:
            print("  ✓ Agent is already not a template")
            
        # 3. Ensure Patient Tool exists with correct symbol
        TOOL_SYMBOL = "query_patient_info"
        TOOL_NAME = "Patient Query Tool"
        
        result = await session.execute(
            select(Tool).where(Tool.symbol == TOOL_SYMBOL)
        )
        tool = result.scalar_one_or_none()
        
        if tool:
            print(f"Found existing tool '{tool.name}' (symbol: {tool.symbol})")
            # Update existing tool
            tool.name = TOOL_NAME
            tool.description = "Query patient information and medical records."
            tool.tool_type = "function"
            tool.scope = "assignable"
            tool.code = None  # IMPORTANT: Set code to None so it uses the registered python function
            tool.assigned_agent_id = internist.id
            print("  ✓ Updated tool configuration and assignment")
        else:
            print(f"Creating new tool '{TOOL_NAME}'")
            tool = Tool(
                name=TOOL_NAME,
                symbol=TOOL_SYMBOL,
                description="Query patient information and medical records.",
                tool_type="function",
                scope="assignable",
                code=None,  # IMPORTANT
                assigned_agent_id=internist.id
            )
            session.add(tool)
            print("  ✓ Created new tool")

        # 4. Clean up any old tools that might have been created by the seed script
        # The seed script likely used a different symbol or name if I couldn't find it easily.
        # But if I use the same symbol, it should be fine.
        # I'll check for tools assigned to Internist that are NOT this one.
        
        await session.flush() # Ensure tool.symbol is available if it was just added
        
        result = await session.execute(
            select(Tool).where(
                Tool.assigned_agent_id == internist.id,
                Tool.symbol != TOOL_SYMBOL
            )
        )
        old_tools = result.scalars().all()
        
        if old_tools:
            print(f"Found {len(old_tools)} other tools assigned to Internist:")
            for old_tool in old_tools:
                print(f"  - {old_tool.name} ({old_tool.symbol})")
                # Should I delete them? The user said "use fixed tools".
                # Maybe I should detach them or delete them.
                # I'll just detach them for safety, unless they are clearly duplicates.
                # If symbol is None (old schema?), delete.
                # For now, I'll leave them but warn.
                # Actually, if the user wants "fixed tools defined in codebase", having other DB-defined tools might be confusing.
                # But I'll be conservative and just ensure the correct one is assigned.

        await session.commit()
        print("Migration complete.")

if __name__ == "__main__":
    asyncio.run(migrate())
