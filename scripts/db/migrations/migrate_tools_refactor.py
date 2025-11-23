import asyncio
import logging
from sqlalchemy import text
from src.config.database import engine

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def migrate():
    """
    Migrate database:
    1. Rename custom_tools table to tools
    2. Drop tool_configs table
    3. Update foreign keys if necessary (Postgres usually handles table renames for FKs, 
       but we need to check if constraints need renaming)
    """
    async with engine.begin() as conn:
        try:
            # 1. Rename table custom_tools -> tools
            logger.info("Renaming table custom_tools to tools...")
            await conn.execute(text("ALTER TABLE IF EXISTS custom_tools RENAME TO tools"))
            
            # Rename the primary key constraint if it has a specific name (optional but good practice)
            # Usually it's custom_tools_pkey
            try:
                await conn.execute(text("ALTER INDEX IF EXISTS custom_tools_pkey RENAME TO tools_pkey"))
            except Exception as e:
                logger.warning(f"Could not rename primary key index: {e}")

            # 2. Drop tool_configs table
            logger.info("Dropping table tool_configs...")
            await conn.execute(text("DROP TABLE IF EXISTS tool_configs"))

            # 3. Update foreign key in agent_tool_assignments
            # The FK constraint name might still reflect custom_tools. 
            # Let's try to rename the constraint if possible, or just leave it as is since it points to the same table OID.
            # However, if we want to be clean, we might want to drop and recreate the FK.
            # For now, let's just ensure the column reference is correct. 
            # Postgres automatically updates FK references when a table is renamed.
            
            logger.info("Migration completed successfully.")
            
        except Exception as e:
            logger.error(f"Migration failed: {e}")
            raise

if __name__ == "__main__":
    asyncio.run(migrate())
