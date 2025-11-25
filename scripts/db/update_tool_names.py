import asyncio
import logging
from src.config.database import AsyncSessionLocal, Tool
from sqlalchemy import select

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Mapping of old names to new names (keeping symbols the same)
TOOL_NAME_UPDATES = {
    "calculate_factorial_debug": "Calculate Factorial Debug",
    "blood_pressure_calculator": "Blood Pressure Calculator",
    "bmi_calculator": "BMI Calculator",
    "medication_reminder": "Medication Reminder",
    "symptom_duration_tracker": "Symptom Duration Tracker",
    "query_patient_info": "Query Patient Info",
}

async def update_tool_names():
    """Update tool names to be more user-friendly."""
    async with AsyncSessionLocal() as session:
        try:
            result = await session.execute(select(Tool))
            tools = result.scalars().all()

            updated_count = 0
            for tool in tools:
                if tool.name in TOOL_NAME_UPDATES:
                    old_name = tool.name
                    new_name = TOOL_NAME_UPDATES[old_name]

                    # Check if we need to update the primary key (name)
                    # We'll need to use raw SQL for this since SQLAlchemy doesn't support PK updates easily
                    from sqlalchemy import text

                    logger.info(f"Updating tool: {old_name} -> {new_name}")

                    await session.execute(
                        text("UPDATE tools SET name = :new_name WHERE name = :old_name"),
                        {"new_name": new_name, "old_name": old_name}
                    )
                    updated_count += 1

            await session.commit()
            logger.info(f"Successfully updated {updated_count} tool names.")

        except Exception as e:
            logger.error(f"Failed to update tool names: {e}")
            await session.rollback()
            raise

if __name__ == "__main__":
    asyncio.run(update_tool_names())
