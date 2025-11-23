"""
Migration script to add new columns to existing tables for multi-agent support.
"""
import asyncio
from sqlalchemy import text
from src.config.database import engine


async def migrate():
    """Add new columns to custom_tools table."""
    print("Running migration: Add multi-agent support columns...")

    async with engine.begin() as conn:
        # Check if columns already exist
        result = await conn.execute(text("""
            SELECT column_name
            FROM information_schema.columns
            WHERE table_name='custom_tools' AND column_name IN ('scope', 'category')
        """))
        existing_columns = [row[0] for row in result]

        # Add scope column if it doesn't exist
        if 'scope' not in existing_columns:
            print("  Adding 'scope' column to custom_tools...")
            await conn.execute(text("""
                ALTER TABLE custom_tools
                ADD COLUMN scope VARCHAR(20) DEFAULT 'global'
            """))
            print("  ✓ Added 'scope' column")
        else:
            print("  ⚠ 'scope' column already exists")

        # Add category column if it doesn't exist
        if 'category' not in existing_columns:
            print("  Adding 'category' column to custom_tools...")
            await conn.execute(text("""
                ALTER TABLE custom_tools
                ADD COLUMN category VARCHAR(50)
            """))
            print("  ✓ Added 'category' column")
        else:
            print("  ⚠ 'category' column already exists")

        # Update existing tools to have 'global' scope
        print("  Setting default scope for existing tools...")
        await conn.execute(text("""
            UPDATE custom_tools
            SET scope = 'global', category = 'general'
            WHERE scope IS NULL OR category IS NULL
        """))
        print("  ✓ Updated existing tools")

    print("✓ Migration completed successfully\n")


if __name__ == "__main__":
    asyncio.run(migrate())
