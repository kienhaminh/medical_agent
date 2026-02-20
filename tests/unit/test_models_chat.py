"""Unit tests for Chat models."""
import pytest
from sqlalchemy import select

from src.models import ChatSession, ChatMessage


@pytest.mark.asyncio
async def test_create_chat_session(db_session):
    """Test creating a chat session."""
    session = ChatSession(title="New Session")
    db_session.add(session)
    await db_session.commit()
    await db_session.refresh(session)
    
    assert session.id is not None
    assert session.title == "New Session"


@pytest.mark.asyncio
async def test_create_chat_message(db_session, sample_chat_session):
    """Test creating a chat message."""
    message = ChatMessage(
        session_id=sample_chat_session.id,
        role="assistant",
        content="This is a response"
    )
    db_session.add(message)
    await db_session.commit()
    await db_session.refresh(message)
    
    assert message.id is not None
    assert message.session_id == sample_chat_session.id
    assert message.role == "assistant"
    assert message.content == "This is a response"


@pytest.mark.asyncio
async def test_chat_session_messages_relationship(db_session, sample_chat_session, sample_chat_message):
    """Test session to messages relationship."""
    result = await db_session.execute(
        select(ChatSession).where(ChatSession.id == sample_chat_session.id)
    )
    session = result.scalar_one()
    
    assert len(session.messages) >= 1
    assert session.messages[0].content == "Hello, I have a question"


@pytest.mark.asyncio
async def test_message_status(db_session, sample_chat_session):
    """Test message status field."""
    message = ChatMessage(
        session_id=sample_chat_session.id,
        role="assistant",
        content="Processing...",
        status="pending"
    )
    db_session.add(message)
    await db_session.commit()
    
    assert message.status == "pending"
