"""Database configuration and base classes."""
import os
import uuid
from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase, sessionmaker
from sqlalchemy.pool import NullPool

load_dotenv()

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

_engine = None
_sync_engine = None
_AsyncSessionLocal = None
_SessionLocal = None


def _get_async_engine():
    global _engine
    if _engine is None:
        if not ASYNC_DATABASE_URL:
            raise RuntimeError("DATABASE_URL environment variable is not set")
        _engine = create_async_engine(
            ASYNC_DATABASE_URL,
            echo=False,
            poolclass=NullPool,
            pool_pre_ping=True,
            connect_args=_async_connect_args,
        )
    return _engine


def _get_sync_engine():
    global _sync_engine
    if _sync_engine is None:
        if not SYNC_DATABASE_URL:
            raise RuntimeError("DATABASE_URL environment variable is not set")
        _sync_engine = create_engine(
            SYNC_DATABASE_URL,
            echo=False,
            pool_pre_ping=True,
            pool_size=5,
            max_overflow=10,
            connect_args=_sync_connect_args,
        )
    return _sync_engine


def _get_async_session_local():
    global _AsyncSessionLocal
    if _AsyncSessionLocal is None:
        _AsyncSessionLocal = async_sessionmaker(
            _get_async_engine(), class_=AsyncSession, expire_on_commit=False
        )
    return _AsyncSessionLocal


def _get_session_local():
    global _SessionLocal
    if _SessionLocal is None:
        _SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=_get_sync_engine())
    return _SessionLocal


class _LazyEngine:
    """Proxy that defers engine creation until first attribute access."""
    def __init__(self, factory):
        object.__setattr__(self, "_factory", factory)

    def __getattr__(self, name):
        return getattr(object.__getattribute__(self, "_factory")(), name)

    def __call__(self, *args, **kwargs):
        return object.__getattribute__(self, "_factory")()(*args, **kwargs)


engine = _LazyEngine(_get_async_engine)
sync_engine = _LazyEngine(_get_sync_engine)
AsyncSessionLocal = _LazyEngine(_get_async_session_local)
SessionLocal = _LazyEngine(_get_session_local)


class Base(DeclarativeBase):
    pass


async def get_db():
    async with _get_async_session_local()() as session:
        yield session


async def init_db():
    from sqlalchemy import text
    async with _get_async_engine().begin() as conn:
        await conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
    await _get_async_engine().dispose()
    async with _get_async_engine().begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
