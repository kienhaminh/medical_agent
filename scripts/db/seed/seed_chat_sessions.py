"""Seed script to create sample chat sessions for testing."""

import asyncio
from datetime import datetime, timedelta
from src.config.database import AsyncSessionLocal, ChatSession, ChatMessage, SubAgent
from sqlalchemy import select

async def seed_chat_sessions():
    """Create sample chat sessions with messages."""
    print("Seeding chat sessions...")

    async with AsyncSessionLocal() as db:
        # Get existing agents
        stmt = select(SubAgent).limit(3)
        result = await db.execute(stmt)
        agents = result.scalars().all()

        if not agents:
            print("No agents found. Please run seed_agents.py first.")
            return

        # Sample sessions
        sessions_data = [
            {
                "title": "Patient diagnosis consultation",
                "agent_id": agents[0].id if len(agents) > 0 else None,
                "created_at": datetime.now() - timedelta(hours=2),
                "updated_at": datetime.now() - timedelta(hours=2),
                "messages": [
                    {
                        "role": "user",
                        "content": "Discuss the differential diagnosis for a 45-year-old patient presenting with chest pain and shortness of breath.",
                    },
                    {
                        "role": "assistant",
                        "content": "For a 45-year-old with chest pain and shortness of breath, we need to consider several serious conditions in the differential diagnosis...",
                        "reasoning": "This requires systematic evaluation of cardiovascular, pulmonary, and other etiologies.",
                    },
                ]
            },
            {
                "title": "Hypertension treatment protocol",
                "agent_id": agents[1].id if len(agents) > 1 else None,
                "created_at": datetime.now() - timedelta(days=1),
                "updated_at": datetime.now() - timedelta(days=1),
                "messages": [
                    {
                        "role": "user",
                        "content": "What are the latest guidelines for managing hypertension in elderly patients?",
                    },
                    {
                        "role": "assistant",
                        "content": "The latest ACC/AHA guidelines recommend a target BP of <130/80 mmHg for most adults, with individualized targets for elderly patients...",
                    },
                ]
            },
            {
                "title": "Medical imaging analysis",
                "agent_id": agents[2].id if len(agents) > 2 else None,
                "created_at": datetime.now() - timedelta(days=3),
                "updated_at": datetime.now() - timedelta(days=3),
                "messages": [
                    {
                        "role": "user",
                        "content": "Can you help me interpret this MRI scan showing abnormalities in the lumbar region?",
                    },
                    {
                        "role": "assistant",
                        "content": "I'll analyze the MRI findings systematically. The lumbar spine MRI shows...",
                    },
                ]
            },
            {
                "title": "Lab results interpretation",
                "agent_id": agents[0].id if len(agents) > 0 else None,
                "created_at": datetime.now() - timedelta(days=7),
                "updated_at": datetime.now() - timedelta(days=7),
                "messages": [
                    {
                        "role": "user",
                        "content": "Patient's CBC shows elevated WBC count with neutrophilia. What could this indicate?",
                    },
                    {
                        "role": "assistant",
                        "content": "Elevated WBC with neutrophilia suggests an acute inflammatory or infectious process...",
                    },
                ]
            },
        ]

        created_count = 0
        for session_data in sessions_data:
            messages_data = session_data["messages"]

            # Skip if session already exists (idempotent)
            existing = await db.execute(
                select(ChatSession).where(ChatSession.title == session_data["title"])
            )
            if existing.scalar_one_or_none():
                print(f"  ⚠ Session '{session_data['title']}' already exists, skipping")
                continue

            payload = {k: v for k, v in session_data.items() if k != "messages"}
            session = ChatSession(**payload)
            db.add(session)
            await db.flush()  # Get the session ID

            # Create messages
            for msg_data in messages_data:
                message = ChatMessage(
                    session_id=session.id,
                    **msg_data
                )
                db.add(message)

            created_count += 1

        await db.commit()
        print(f"✓ Created {created_count} sample chat sessions")

if __name__ == "__main__":
    asyncio.run(seed_chat_sessions())
