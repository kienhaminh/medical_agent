"""
Ensure the core patient lookup tool exists in the database and is assigned to the Internist agent.
"""
import asyncio
from sqlalchemy import select
from src.config.database import AsyncSessionLocal, SubAgent, Tool

PATIENT_TOOL = {
    "name": "Query Patient Basic Info",
    "symbol": "query_patient_basic_info",
    "description": "Return patient demographics (ID, name, DOB, gender) filtered by identifier or name.",
    "tool_type": "function",
    "scope": "global",
    "enabled": True,
    "test_passed": True,
}

async def add_patient_tool(session):
    """Add patient query tool to tools table."""
    print("Adding patient query tool to tools...")
    result = await session.execute(select(Tool).where(Tool.symbol == PATIENT_TOOL["symbol"]))
    existing_tool = result.scalar_one_or_none()

    if existing_tool:
        print(f"  ⚠ Tool '{PATIENT_TOOL['name']}' already exists, updating...")
        for key, value in PATIENT_TOOL.items():
            setattr(existing_tool, key, value)
    else:
        tool = Tool(**PATIENT_TOOL)
        session.add(tool)
        print(f"  ✓ Created tool: {PATIENT_TOOL['name']}")

    await session.commit()
    print("✓ Patient query tool ready\n")


async def assign_tool_to_internist(session):
    """Assign patient query tool to Internist agent."""
    print("Assigning patient query tool to Internist...")

    # Get Internist agent
    result = await session.execute(
        select(SubAgent).where(SubAgent.role == "clinical_text")
    )
    internist = result.scalar_one_or_none()

    if not internist:
        print("  ✗ Internist agent not found. Please run seed_agents.py first.")
        return

    result = await session.execute(select(Tool).where(Tool.symbol == PATIENT_TOOL["symbol"]))
    patient_tool = result.scalar_one_or_none()

    if not patient_tool:
        print("  ✗ Patient tool not found in database.")
        return

    # Check if assignment already exists
    if patient_tool.assigned_agent_id:
        if patient_tool.assigned_agent_id == internist.id:
             print(f"  ⚠ Tool already assigned to Internist.")
        else:
             print(f"  ⚠ Tool assigned to another agent (ID {patient_tool.assigned_agent_id}). Reassigning to Internist...")
             patient_tool.assigned_agent_id = internist.id
    else:
        # Create new assignment
        patient_tool.assigned_agent_id = internist.id
        print(f"  ✓ Assigned '{PATIENT_TOOL['name']}' to Internist")

    await session.commit()
    print("✓ Assignment complete\n")


async def verify_setup(session):
    """Verify the setup is correct."""
    print("Verifying setup...")

    # Get Internist agent with tools
    result = await session.execute(
        select(SubAgent).where(SubAgent.role == "clinical_text")
    )
    internist = result.scalar_one_or_none()

    if not internist:
        print("  ✗ Internist agent not found")
        return

    # Get assigned tools
    result = await session.execute(
        select(Tool).where(
            Tool.assigned_agent_id == internist.id,
            Tool.enabled.is_(True)
        )
    )
    tools = result.scalars().all()

    print(f"  ✓ Internist agent found: {internist.name}")
    print(f"  ✓ Assigned tools ({len(tools)}):")
    for tool in tools:
        print(f"    - {tool.name} [{tool.symbol}] (scope={tool.scope})")

    print()


async def main():
    """Main seeding function."""
    print("=" * 70)
    print("PATIENT TOOL ASSIGNMENT SEEDER")
    print("=" * 70)
    print()

    async with AsyncSessionLocal() as session:
        # Step 1: Add patient tool to database
        await add_patient_tool(session)

        # Step 2: Assign to Internist
        await assign_tool_to_internist(session)

        # Step 3: Verify setup
        await verify_setup(session)

    print("=" * 70)
    print("✓ SETUP COMPLETED SUCCESSFULLY")
    print("=" * 70)
    print()
    print("Next steps:")
    print("  1. Restart the API server if running: python -m src.api")
    print("  2. Test the flow:")
    print("     curl -X POST http://localhost:8000/api/chat \\")
    print("       -H 'Content-Type: application/json' \\")
    print("       -d '{\"message\": \"Who is patient 2?\", \"user_id\": \"test_user\"}'")
    print()


if __name__ == "__main__":
    asyncio.run(main())
