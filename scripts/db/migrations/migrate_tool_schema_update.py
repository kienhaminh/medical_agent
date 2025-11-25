import asyncio
import logging
from sqlalchemy import text
from src.config.database import engine

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def migrate():
    """
    Migrate database tools table:
    1. Add symbol column (snake_case identifier)
    2. Add tool_type column (function or api)
    3. Add api_endpoint, api_request_payload, api_response_payload columns
    4. Remove enabled column
    5. Remove category column
    6. Make code column nullable
    """
    async with engine.begin() as conn:
        try:
            # 1. Add new columns
            logger.info("Adding symbol column...")
            await conn.execute(text("""
                ALTER TABLE tools
                ADD COLUMN IF NOT EXISTS symbol VARCHAR(100) UNIQUE
            """))

            logger.info("Adding tool_type column...")
            await conn.execute(text("""
                ALTER TABLE tools
                ADD COLUMN IF NOT EXISTS tool_type VARCHAR(20) DEFAULT 'function'
            """))

            logger.info("Adding API-related columns...")
            await conn.execute(text("""
                ALTER TABLE tools
                ADD COLUMN IF NOT EXISTS api_endpoint VARCHAR(500),
                ADD COLUMN IF NOT EXISTS api_request_payload TEXT,
                ADD COLUMN IF NOT EXISTS api_response_payload TEXT
            """))

            # 2. Populate symbol for existing tools (convert name to snake_case)
            logger.info("Populating symbol for existing tools...")
            await conn.execute(text("""
                UPDATE tools
                SET symbol = LOWER(REPLACE(REPLACE(name, ' ', '_'), '-', '_'))
                WHERE symbol IS NULL
            """))

            # 3. Make symbol NOT NULL after populating
            logger.info("Making symbol column NOT NULL...")
            await conn.execute(text("""
                ALTER TABLE tools
                ALTER COLUMN symbol SET NOT NULL
            """))

            # 4. Make code column nullable
            logger.info("Making code column nullable...")
            await conn.execute(text("""
                ALTER TABLE tools
                ALTER COLUMN code DROP NOT NULL
            """))

            # 5. Drop enabled column
            logger.info("Dropping enabled column...")
            await conn.execute(text("""
                ALTER TABLE tools
                DROP COLUMN IF EXISTS enabled
            """))

            # 6. Drop category column
            logger.info("Dropping category column...")
            await conn.execute(text("""
                ALTER TABLE tools
                DROP COLUMN IF EXISTS category
            """))

            logger.info("Migration completed successfully.")

        except Exception as e:
            logger.error(f"Migration failed: {e}")
            raise

if __name__ == "__main__":
    asyncio.run(migrate())
