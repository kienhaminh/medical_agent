"""Migration script to add chat_sessions and chat_messages tables."""

import asyncio
from src.config.database import engine, Base, ChatSession, ChatMessage

async def migrate():
    """Create chat session tables if they don't exist."""
    print("Starting migration for chat sessions...")

    async with engine.begin() as conn:
        # Import all models to ensure they're registered
        print("Creating tables...")
        await conn.run_sync(Base.metadata.create_all)

    print("Migration completed successfully!")
    print("Created tables:")
    print("  - chat_sessions")
    print("  - chat_messages")

if __name__ == "__main__":
    asyncio.run(migrate())
