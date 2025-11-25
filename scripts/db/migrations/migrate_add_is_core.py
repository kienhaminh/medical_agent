"""
Migration script to add 'is_core' column to SubAgent table.
"""
import asyncio
import sys
import os
from dotenv import load_dotenv
from sqlalchemy import text

# Load environment variables
load_dotenv()

# Add project root to python path
sys.path.append(os.getcwd())

from src.config.database import engine

async def migrate_add_is_core():
    print("Adding 'is_core' column to sub_agents table...")
    
    async with engine.begin() as conn:
        # Check if column exists
        result = await conn.execute(text(
            "SELECT column_name FROM information_schema.columns "
            "WHERE table_name='sub_agents' AND column_name='is_core'"
        ))
        if result.scalar():
            print("  ⚠ Column 'is_core' already exists.")
        else:
            await conn.execute(text(
                "ALTER TABLE sub_agents ADD COLUMN is_core BOOLEAN DEFAULT FALSE"
            ))
            print("  ✓ Added column 'is_core'")

        # Update Internist to be core
        await conn.execute(text(
            "UPDATE sub_agents SET is_core = TRUE WHERE role = 'clinical_text' OR name = 'Internist'"
        ))
        print("  ✓ Set Internist as core agent")

    await engine.dispose()
    print("Migration complete.")

if __name__ == "__main__":
    asyncio.run(migrate_add_is_core())
