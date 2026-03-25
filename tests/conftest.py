"""Pytest configuration and fixtures."""
import asyncio
import os
import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.pool import NullPool

from src.models.base import Base
from src.models import Patient, MedicalRecord, ChatSession, ChatMessage

# Use SQLite for testing
TEST_DATABASE_URL = "sqlite+aiosqlite:///./test.db"


@pytest.fixture(scope="session")
def event_loop():
    """Create an instance of the default event loop for the test session."""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


@pytest_asyncio.fixture(scope="session")
async def test_engine():
    """Create a test database engine."""
    engine = create_async_engine(
        TEST_DATABASE_URL,
        echo=False,
        poolclass=NullPool,
    )
    
    # Create tables
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    
    yield engine
    
    # Cleanup
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await engine.dispose()


@pytest_asyncio.fixture
async def db_session(test_engine):
    """Create a fresh database session for each test with savepoint-based isolation.

    Uses a nested transaction (SAVEPOINT) so that commits inside tests only
    flush to the savepoint. The outer transaction is rolled back after each
    test, keeping the database clean for the next test.
    """
    async with test_engine.connect() as conn:
        # Begin an outer transaction that will be rolled back after the test
        await conn.begin()
        # Open a SAVEPOINT so that session.commit() only flushes to it
        await conn.begin_nested()

        async_session = async_sessionmaker(
            bind=conn, class_=AsyncSession, expire_on_commit=False, join_transaction_mode="create_savepoint"
        )

        async with async_session() as session:
            yield session

        # Roll back the outer transaction — undoes everything done in this test
        await conn.rollback()


@pytest_asyncio.fixture
async def sample_patient(db_session):
    """Create a sample patient for testing."""
    patient = Patient(
        name="John Doe",
        dob="1990-01-01",
        gender="male"
    )
    db_session.add(patient)
    await db_session.commit()
    await db_session.refresh(patient)
    return patient


@pytest_asyncio.fixture
async def sample_medical_record(db_session, sample_patient):
    """Create a sample medical record for testing."""
    record = MedicalRecord(
        patient_id=sample_patient.id,
        record_type="text",
        content="Patient reports headaches",
        summary="Headache complaint"
    )
    db_session.add(record)
    await db_session.commit()
    await db_session.refresh(record)
    return record


@pytest_asyncio.fixture
async def sample_chat_session(db_session):
    """Create a sample chat session for testing."""
    session = ChatSession(title="Test Session")
    db_session.add(session)
    await db_session.commit()
    await db_session.refresh(session)
    return session


@pytest_asyncio.fixture
async def sample_chat_message(db_session, sample_chat_session):
    """Create a sample chat message for testing."""
    message = ChatMessage(
        session_id=sample_chat_session.id,
        role="user",
        content="Hello, I have a question"
    )
    db_session.add(message)
    await db_session.commit()
    await db_session.refresh(message)
    return message
