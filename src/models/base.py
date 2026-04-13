"""Database configuration and base classes."""
import os
from dotenv import load_dotenv
from sqlalchemy import create_engine

load_dotenv()
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase, sessionmaker
from sqlalchemy.pool import NullPool

# Database URL from environment
DATABASE_URL = os.getenv("DATABASE_URL", "")

# SSL toggle — set DATABASE_SSL=true when connecting to Supabase or any
# cloud Postgres that requires SSL. Leave false (default) for local dev.
_ssl_enabled = os.getenv("DATABASE_SSL", "false").lower() == "true"

def _normalize_url(url: str, driver: str) -> str:
    """Ensure the URL uses the specified driver (asyncpg or psycopg2)."""
    base = (
        url.replace("postgresql+asyncpg://", "postgresql://")
           .replace("postgresql+psycopg2://", "postgresql://")
    )
    return base.replace("postgresql://", f"postgresql+{driver}://", 1)


ASYNC_DATABASE_URL = _normalize_url(DATABASE_URL, "asyncpg")

# Connect args — asyncpg uses ssl=True, psycopg2 uses sslmode=require
_async_connect_args = {"ssl": True} if _ssl_enabled else {}
_sync_connect_args = {"sslmode": "require"} if _ssl_enabled else {}

# Async Engine with NullPool to avoid sharing connections across event loops
engine = create_async_engine(
    ASYNC_DATABASE_URL,
    echo=False,
    poolclass=NullPool,
    pool_pre_ping=True,
    connect_args=_async_connect_args,
)

# Async Session Factory
AsyncSessionLocal = async_sessionmaker(
    engine, class_=AsyncSession, expire_on_commit=False
)

# Synchronous Database Access (for Tools)
SYNC_DATABASE_URL = _normalize_url(DATABASE_URL, "psycopg2")

sync_engine = create_engine(
    SYNC_DATABASE_URL,
    echo=False,
    pool_pre_ping=True,
    pool_size=5,
    max_overflow=10,
    connect_args=_sync_connect_args,
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=sync_engine)


class Base(DeclarativeBase):
    """Base class for all models."""
    pass


async def get_db():
    """Dependency for getting async database session."""
    async with AsyncSessionLocal() as session:
        yield session


async def init_db():
    """Initialize database with pgvector extension and create tables."""
    from sqlalchemy import text

    # Create pgvector extension first
    async with engine.begin() as conn:
        await conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))

    # Dispose engine to force new connections
    await engine.dispose()

    # Create tables
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
