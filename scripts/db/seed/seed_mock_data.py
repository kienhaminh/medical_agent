"""
Mock data seeder for AI Agent project.
Generates realistic medical records, patients, and custom tools.
"""
import asyncio
import random
from datetime import datetime, timedelta
from sqlalchemy import select
from src.config.database import AsyncSessionLocal, Patient, MedicalRecord, Tool

# ... (rest of imports)

# ... (data definitions)

async def seed_custom_tools(session):
    """Seed custom tools."""
    print(f"Seeding custom tools...")

    for tool_data in CUSTOM_TOOLS_DATA:
        # Check if tool already exists
        result = await session.execute(
            select(Tool).where(Tool.name == tool_data["name"])
        )
        existing_tool = result.scalar_one_or_none()

        if not existing_tool:
            tool = Tool(**tool_data, enabled=True)
            session.add(tool)

    await session.commit()
    print(f"✓ Created {len(CUSTOM_TOOLS_DATA)} custom tools")


async def clear_existing_data(session):
    """Clear existing mock data (optional)."""
    print("Clearing existing data...")

    # Delete in correct order due to foreign key constraints
    await session.execute(MedicalRecord.__table__.delete())
    await session.execute(Patient.__table__.delete())
    await session.execute(Tool.__table__.delete())
    # await session.execute(ToolConfig.__table__.delete())

    await session.commit()
    print("✓ Cleared existing data")


async def main(clear_first=False, num_patients=20):
    """Main seeding function."""
    print("=" * 60)
    print("AI Agent Mock Data Seeder")
    print("=" * 60)

    async with AsyncSessionLocal() as session:
        if clear_first:
            await clear_existing_data(session)

        # Seed data
        patients = await seed_patients(session, num_patients)
        await seed_medical_records(session, patients)
        await seed_custom_tools(session)
        # await seed_tool_configs(session)

    print("=" * 60)
    print("✓ Mock data seeding completed successfully!")
    print("=" * 60)
    print(f"\nSummary:")
    print(f"  - {num_patients} patients created")
    print(f"  - ~{num_patients * 3} medical records created")
    print(f"  - {len(CUSTOM_TOOLS_DATA)} custom tools created")
    print(f"  - Tool configurations initialized")
    print("\nYou can now:")
    print("  - Start the API server: python -m src.api")
    print("  - View patients: curl http://localhost:8000/api/patients")
    print("  - Search records: curl http://localhost:8000/api/records/search?query=fever")
    print("  - List tools: curl http://localhost:8000/api/tools")


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Seed mock data for AI Agent")
    parser.add_argument("--clear", action="store_true", help="Clear existing data before seeding")
    parser.add_argument("--patients", type=int, default=20, help="Number of patients to create (default: 20)")

    args = parser.parse_args()

    asyncio.run(main(clear_first=args.clear, num_patients=args.patients))
