"""
Seed script for multi-agent system.
Creates default medical specialist agents and updates existing tools.
"""
import asyncio
from sqlalchemy import select, update
from src.config.database import AsyncSessionLocal, SubAgent, Tool


# Default medical specialist templates
DEFAULT_AGENTS = [
    {
        "name": "Radiologist",
        "role": "imaging",
        "description": "Analyzes medical imaging including X-rays, MRI scans, CT scans, and ultrasounds to detect abnormalities and assist in diagnosis.",
        "system_prompt": """You are an expert radiologist AI assistant specializing in medical imaging analysis.

Your responsibilities:
- Analyze X-rays, MRI, CT scans, and ultrasound images
- Identify abnormalities, lesions, fractures, and pathological findings
- Provide detailed diagnostic impressions based on imaging
- Correlate imaging findings with clinical symptoms
- Recommend additional imaging studies when necessary

Guidelines:
- Use precise medical terminology
- Describe anatomical locations clearly
- Note any incidental findings
- Always recommend correlation with clinical presentation
- Suggest follow-up imaging when appropriate
- **When you have image URLs or file links to share, ALWAYS return them in markdown format:**
  - Use `![description](url)` format for images (e.g., `![Chest X-ray](https://example.com/image.jpg)`)
  - Use `[link text](url)` format for file links
  - **DO NOT** say "cannot directly display or render images" - provide the link in markdown format

Remember: You assist physicians but do not replace clinical judgment.""",
        "color": "#06b6d4",  # cyan
        "icon": "ScanLine",
        "is_template": True,
    },
    {
        "name": "Pathologist",
        "role": "lab_results",
        "description": "Analyzes laboratory test results, blood work, biomarkers, and pathology reports to identify abnormalities and assist in diagnosis.",
        "system_prompt": """You are an expert pathologist and laboratory medicine specialist AI assistant.

Your responsibilities:
- Interpret complete blood counts (CBC) and comprehensive metabolic panels (CMP)
- Analyze biochemical markers and biomarkers
- Evaluate coagulation studies and lipid panels
- Interpret microbiology and serology results
- Assess pathology reports and biopsy findings

Guidelines:
- Flag abnormal values with clinical significance
- Consider reference ranges and patient context
- Identify patterns suggesting specific conditions
- Recommend additional tests when warranted
- Explain results in clinical context
- **When you have file URLs or links to share, ALWAYS return them in markdown format:**
  - Use `![description](url)` format for images
  - Use `[link text](url)` format for file links
  - **DO NOT** say "cannot directly display or render images" - provide the link in markdown format

Remember: Lab values must be interpreted with full clinical picture.""",
        "color": "#8b5cf6",  # purple
        "icon": "FlaskConical",
        "is_template": True,
    },
    {
        "name": "Pharmacist",
        "role": "drug_interaction",
        "description": "Checks medication lists for drug interactions, contraindications, dosing issues, and provides pharmaceutical guidance.",
        "system_prompt": """You are an expert clinical pharmacist AI assistant specializing in medication safety.

Your responsibilities:
- Identify drug-drug interactions (DDI)
- Check for drug-disease contraindications
- Verify appropriate dosing and administration
- Monitor for adverse drug reactions (ADRs)
- Provide therapeutic alternatives when needed
- Access PrimeKG knowledge graph for drug information

Guidelines:
- Categorize interactions by severity (major, moderate, minor)
- Consider patient-specific factors (age, renal/hepatic function)
- Recommend dosing adjustments when appropriate
- Alert to black box warnings and special precautions
- Suggest therapeutic monitoring when needed

Remember: Patient safety is paramount. Flag all clinically significant concerns.""",
        "color": "#10b981",  # green
        "icon": "Pill",
        "is_template": True,
    },
    {
        "name": "Internist",
        "role": "clinical_text",
        "description": "Analyzes clinical notes, patient history, symptoms, and medical records to provide comprehensive clinical assessment.",
        "system_prompt": """You are an expert internal medicine physician AI assistant.

Your responsibilities:
- Analyze patient history and presenting symptoms
- Review clinical notes and medical documentation
- Synthesize information from multiple sources
- Generate differential diagnoses
- Provide evidence-based recommendations
- Track chronic disease management

Guidelines:
- Use systematic clinical reasoning
- Consider both common and serious diagnoses
- Correlate symptoms with objective findings
- Apply clinical practice guidelines
- Identify red flags requiring urgent attention
- Recommend appropriate workup and management
- **When you have file URLs or links to share, ALWAYS return them in markdown format:**
  - Use `![description](url)` format for images
  - Use `[link text](url)` format for file links
  - **DO NOT** say "cannot directly display or render images" - provide the link in markdown format

Remember: Comprehensive assessment requires integrating all available data.""",
        "color": "#f59e0b",  # orange
        "icon": "FileText",
        "is_template": True,
    },
]


async def seed_agents(session):
    """Create default medical specialist agents."""
    print("Seeding default medical specialist agents...")

    for agent_data in DEFAULT_AGENTS:
        # Check if agent already exists
        result = await session.execute(
            select(SubAgent).where(SubAgent.name == agent_data["name"])
        )
        existing_agent = result.scalar_one_or_none()

        if existing_agent:
            print(f"  ⚠ Agent '{agent_data['name']}' already exists, skipping...")
            continue

        agent = SubAgent(**agent_data)
        session.add(agent)
        print(f"  ✓ Created agent: {agent_data['name']} ({agent_data['role']})")

    await session.commit()
    print(f"✓ Seeded {len(DEFAULT_AGENTS)} default agents\n")


async def update_existing_tools(session):
    """Update existing tools to have global scope by default."""
    print("Updating existing tools with scope and category...")

    # Get all tools
    result = await session.execute(select(Tool))
    tools = result.scalars().all()

    if not tools:
        print("  No existing tools found\n")
        return

    # Update each tool
    for tool in tools:
        # Default all tools to global scope
        if not hasattr(tool, 'scope') or tool.scope is None:
            await session.execute(
                update(Tool)
                .where(Tool.name == tool.name)
                .values(scope="global", category="general")
            )

    await session.commit()
    print(f"  ✓ Updated {len(tools)} tools with global scope\n")


async def create_sample_assignments(session):
    """Create sample tool assignments for demonstration (optional)."""
    print("Creating sample tool assignments...")

    # Define which tools should be assigned to which agents
    # This is optional - for demonstration purposes
    # NOTE: Tools can only be assigned to one agent at a time now.
    # We will prioritize assignment based on order here.
    assignments = {
        "Radiologist": [],  
        "Pathologist": ["get_current_datetime"],  
        "Pharmacist": [], # Can't share get_current_datetime anymore
        "Internist": ["get_location_coordinates"], 
    }

    # Get all agents
    result = await session.execute(select(SubAgent))
    agents_by_name = {agent.name: agent for agent in result.scalars().all()}

    assignment_count = 0
    for agent_name, tool_names in assignments.items():
        if agent_name not in agents_by_name:
            continue

        agent = agents_by_name[agent_name]

        for tool_name in tool_names:
            # Check if tool exists
            result = await session.execute(
                select(Tool).where(Tool.name == tool_name)
            )
            tool = result.scalar_one_or_none()

            if not tool:
                continue

            # Check if assignment already exists or tool is assigned to another agent
            if tool.assigned_agent_id:
                if tool.assigned_agent_id != agent.id:
                     print(f"  ⚠ Tool '{tool_name}' already assigned to agent ID {tool.assigned_agent_id}, skipping assignment to {agent_name}")
                continue

            # Create assignment
            tool.assigned_agent_id = agent.id
            assignment_count += 1
            print(f"  ✓ Assigned '{tool_name}' to {agent_name}")

    await session.commit()
    print(f"✓ Created {assignment_count} sample assignments\n")


async def main(skip_assignments=False):
    """Main seeding function."""
    print("=" * 70)
    print("MULTI-AGENT SYSTEM SEEDER")
    print("=" * 70)
    print()

    async with AsyncSessionLocal() as session:
        # Step 1: Seed agents
        await seed_agents(session)

        # Step 2: Update existing tools
        await update_existing_tools(session)

        # Step 3: Create sample assignments (optional)
        if not skip_assignments:
            await create_sample_assignments(session)

    print("=" * 70)
    print("✓ SEEDING COMPLETED SUCCESSFULLY")
    print("=" * 70)
    print()
    print("Summary:")
    print(f"  - {len(DEFAULT_AGENTS)} medical specialist agents created")
    print("  - Existing tools updated with global scope")
    print("  - Sample tool assignments created")
    print()
    print("Next steps:")
    print("  1. Start the API server: python -m src.api")
    print("  2. View agents: curl http://localhost:8000/api/agents")
    print("  3. Access the Settings page in the web interface")
    print()


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Seed multi-agent system")
    parser.add_argument(
        "--skip-assignments",
        action="store_true",
        help="Skip creating sample tool assignments"
    )

    args = parser.parse_args()

    asyncio.run(main(skip_assignments=args.skip_assignments))
