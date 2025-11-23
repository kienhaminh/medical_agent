"""
Seed script to ensure patient query tool is available and assigned to Internist.
This script:
1. Adds query_patient_info to custom_tools table (if not exists)
2. Assigns it to the Internist agent
"""
import asyncio
from sqlalchemy import select
from src.config.database import AsyncSessionLocal, SubAgent, Tool, AgentToolAssignment

# ...

async def add_patient_tool(session):
    """Add patient query tool to tools table."""
    print("Adding patient query tool to tools...")

    # Check if tool already exists
    result = await session.execute(
        select(Tool).where(Tool.name == PATIENT_TOOL["name"])
    )
    existing_tool = result.scalar_one_or_none()

    if existing_tool:
        print(f"  ⚠ Tool '{PATIENT_TOOL['name']}' already exists, updating...")
        # Update existing tool
        existing_tool.description = PATIENT_TOOL["description"]
        existing_tool.code = PATIENT_TOOL["code"]
        existing_tool.enabled = PATIENT_TOOL["enabled"]
        existing_tool.scope = PATIENT_TOOL["scope"]
        existing_tool.category = PATIENT_TOOL["category"]
    else:
        # Create new tool
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

    # Get patient tool
    result = await session.execute(
        select(Tool).where(Tool.name == PATIENT_TOOL["name"])
    )
    patient_tool = result.scalar_one_or_none()

    if not patient_tool:
        print("  ✗ Patient tool not found in database.")
        return

    # Check if assignment already exists
    result = await session.execute(
        select(AgentToolAssignment).where(
            AgentToolAssignment.agent_id == internist.id,
            AgentToolAssignment.tool_name == PATIENT_TOOL["name"]
        )
    )
    existing_assignment = result.scalar_one_or_none()

    if existing_assignment:
        print(f"  ⚠ Tool already assigned to Internist, ensuring it's enabled...")
        existing_assignment.enabled = True
    else:
        # Create new assignment
        assignment = AgentToolAssignment(
            agent_id=internist.id,
            tool_name=PATIENT_TOOL["name"],
            enabled=True
        )
        session.add(assignment)
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
        select(Tool)
        .join(AgentToolAssignment)
        .where(
            AgentToolAssignment.agent_id == internist.id,
            AgentToolAssignment.enabled == True
        )
    )
    tools = result.scalars().all()

    print(f"  ✓ Internist agent found: {internist.name}")
    print(f"  ✓ Assigned tools ({len(tools)}):")
    for tool in tools:
        print(f"    - {tool.name} ({tool.category})")

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
