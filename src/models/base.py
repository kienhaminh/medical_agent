"""Database configuration and base classes."""
import os
import uuid
from dotenv import load_dotenv
from sqlalchemy import create_engine

load_dotenv()
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase, sessionmaker
from sqlalchemy.pool import NullPool

DATABASE_URL = os.getenv("DATABASE_URL", "")
_ssl_enabled = os.getenv("DATABASE_SSL", "false").lower() == "true"


def _normalize_url(url: str, driver: str) -> str:
    if not url:
        return url
    base = url.replace("postgres://", "postgresql://", 1)
    base = (
        base.replace("postgresql+asyncpg://", "postgresql://")
            .replace("postgresql+psycopg2://", "postgresql://")
    )
    return base.replace("postgresql://", f"postgresql+{driver}://", 1)


ASYNC_DATABASE_URL = _normalize_url(DATABASE_URL, "asyncpg")
SYNC_DATABASE_URL = _normalize_url(DATABASE_URL, "psycopg2")

_async_connect_args: dict = {
    "statement_cache_size": 0,
    "prepared_statement_name_func": lambda: f"pstmt_{uuid.uuid4().hex}",
}
if _ssl_enabled:
    _async_connect_args["ssl"] = True

_sync_connect_args = {"sslmode": "require"} if _ssl_enabled else {}

engine = create_async_engine(
    ASYNC_DATABASE_URL,
    echo=False,
    poolclass=NullPool,
    pool_pre_ping=True,
    connect_args=_async_connect_args,
)

AsyncSessionLocal = async_sessionmaker(
    engine, class_=AsyncSession, expire_on_commit=False
)

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
    pass


async def get_db():
    async with AsyncSessionLocal() as session:
        yield session


async def init_db():
    from sqlalchemy import text
    async with engine.begin() as conn:
        await conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
    await engine.dispose()
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
