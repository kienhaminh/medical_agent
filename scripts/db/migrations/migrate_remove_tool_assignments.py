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
    1. Add assigned_agent_id column to tools table
    2. Migrate existing assignments from agent_tool_assignments to tools
    3. Drop agent_tool_assignments table
    """
    async with engine.begin() as conn:
        try:
            # 1. Add assigned_agent_id column
            logger.info("Adding assigned_agent_id column to tools...")
            # Check if column exists first to avoid error on re-run
            result = await conn.execute(text(
                "SELECT column_name FROM information_schema.columns WHERE table_name='tools' AND column_name='assigned_agent_id'"
            ))
            if not result.scalar():
                await conn.execute(text(
                    "ALTER TABLE tools ADD COLUMN assigned_agent_id INTEGER REFERENCES sub_agents(id) ON DELETE SET NULL"
                ))

            # 2. Migrate data
            logger.info("Migrating assignments...")
            # We take the first assignment found for each tool if multiple exist (arbitrary choice due to new 1:N constraint)
            await conn.execute(text("""
                UPDATE tools 
                SET assigned_agent_id = subquery.agent_id
                FROM (
                    SELECT DISTINCT ON (tool_name) tool_name, agent_id
                    FROM agent_tool_assignments
                    ORDER BY tool_name, created_at DESC
                ) AS subquery
                WHERE tools.name = subquery.tool_name
            """))

            # 3. Drop old table
            logger.info("Dropping agent_tool_assignments table...")
            await conn.execute(text("DROP TABLE IF EXISTS agent_tool_assignments CASCADE"))

            logger.info("Migration completed successfully.")
            
        except Exception as e:
            logger.error(f"Migration failed: {e}")
            raise

if __name__ == "__main__":
    asyncio.run(migrate())
