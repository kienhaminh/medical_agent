"""Check token usage in database."""
import asyncio
from dotenv import load_dotenv
load_dotenv()

from sqlalchemy import select, func
from src.config.database import AsyncSessionLocal, ChatMessage

async def check_usage():
    async with AsyncSessionLocal() as db:
        # Count total assistant messages
        stmt1 = select(func.count()).select_from(ChatMessage).where(ChatMessage.role == 'assistant')
        result = await db.execute(stmt1)
        total = result.scalar()

        # Count assistant messages with token_usage
        stmt2 = select(func.count()).select_from(ChatMessage).where(
            (ChatMessage.role == 'assistant') & (ChatMessage.token_usage.isnot(None))
        )
        result = await db.execute(stmt2)
        with_usage = result.scalar()

        print(f'Total assistant messages: {total}')
        print(f'Messages with token_usage: {with_usage}')

        # Get latest messages
        stmt3 = select(ChatMessage.id, ChatMessage.role, ChatMessage.token_usage).order_by(ChatMessage.created_at.desc()).limit(10)
        result = await db.execute(stmt3)
        messages = result.all()
        print('\nRecent messages:')
        for msg in messages:
            usage_preview = msg[2][:100] if msg[2] else None
            print(f'  ID: {msg[0]}, Role: {msg[1]}, Usage: {usage_preview}')

asyncio.run(check_usage())
