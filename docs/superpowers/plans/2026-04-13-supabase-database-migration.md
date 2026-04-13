# Supabase Database Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Point the backend SQLAlchemy database connection at Supabase's managed PostgreSQL, with SSL support toggled via an env var.

**Architecture:** Add a `DATABASE_SSL` env var read in `src/models/base.py`; when true, pass SSL connect_args to both async and sync engines. Update `.env.example` to document the Supabase connection string format. No model, query, or API logic changes.

**Tech Stack:** SQLAlchemy 2.0 async (asyncpg), SQLAlchemy sync (psycopg2), FastAPI, Supabase PostgreSQL

---

### Task 1: Add SSL support to database engines

**Files:**
- Modify: `src/models/base.py`
- Modify: `.env.example`

- [ ] **Step 1: Write a failing test for SSL connect_args**

Create `tests/test_database_ssl.py`:

```python
"""Tests for DATABASE_SSL env var wiring in base.py engine creation."""
import importlib
import os
import sys


def _reload_base(monkeypatch, database_url: str, ssl: str):
    """Reload src.models.base with patched env vars."""
    monkeypatch.setenv("DATABASE_URL", database_url)
    monkeypatch.setenv("DATABASE_SSL", ssl)
    # Remove cached module so env vars are re-read on import
    for key in list(sys.modules.keys()):
        if "src.models.base" in key:
            del sys.modules[key]
    return importlib.import_module("src.models.base")


def test_ssl_disabled_no_connect_args(monkeypatch):
    """When DATABASE_SSL=false, engines must have no ssl connect_args."""
    base = _reload_base(
        monkeypatch,
        "postgresql+asyncpg://postgres:postgres@localhost:5432/medinexus",
        "false",
    )
    # asyncpg engine: no ssl in creator kwargs
    async_kwargs = base.engine.get_engine().url.query
    assert "ssl" not in str(base.engine.get_engine().url)


def test_ssl_enabled_async_connect_args(monkeypatch):
    """When DATABASE_SSL=true, async engine must have ssl=True in connect_args."""
    base = _reload_base(
        monkeypatch,
        "postgresql+asyncpg://postgres:pass@db.abc.supabase.co:5432/postgres",
        "true",
    )
    # Inspect the engine's pool._creator kwargs via dialect connect_args
    dialect = base.engine.get_engine().dialect
    connect_args = dialect.create_connect_args.__func__
    # Simpler: check the stored _connect_args on the engine directly
    stored = base.engine.get_engine().dialect._connect_args
    assert stored.get("ssl") is True


def test_ssl_enabled_sync_connect_args(monkeypatch):
    """When DATABASE_SSL=true, sync engine must have sslmode=require in connect_args."""
    base = _reload_base(
        monkeypatch,
        "postgresql+asyncpg://postgres:pass@db.abc.supabase.co:5432/postgres",
        "true",
    )
    stored = base.sync_engine.dialect._connect_args
    assert stored.get("sslmode") == "require"
```

- [ ] **Step 2: Run the test to confirm it fails**

```bash
cd /Users/kien.ha/Code/medical_agent
python -m pytest tests/test_database_ssl.py -v 2>&1 | head -40
```

Expected: FAIL — `AttributeError` or `AssertionError` because SSL args are not wired yet.

- [ ] **Step 3: Update `src/models/base.py` to read DATABASE_SSL and pass connect_args**

Replace the engine creation block. Full file content:

```python
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

ASYNC_DATABASE_URL = DATABASE_URL.replace("+psycopg2", "+asyncpg") if "+psycopg2" in DATABASE_URL else DATABASE_URL

# Async Engine with NullPool to avoid sharing connections across event loops
_async_connect_args = {"ssl": True} if _ssl_enabled else {}
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
SYNC_DATABASE_URL = DATABASE_URL.replace("+asyncpg", "+psycopg2") if "+asyncpg" in DATABASE_URL else DATABASE_URL

_sync_connect_args = {"sslmode": "require"} if _ssl_enabled else {}
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
```

- [ ] **Step 4: Update `.env.example` to document Supabase connection format**

Add the Supabase section so the DATABASE_URL line reads:

```
# Local development
DATABASE_URL=postgresql+asyncpg://postgres:postgres@localhost:5432/medinexus
DATABASE_SSL=false

# Supabase (production) — use Session Mode pooler (port 5432) for SQLAlchemy
# DATABASE_URL=postgresql+asyncpg://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:5432/postgres
# DATABASE_SSL=true
```

- [ ] **Step 5: Run tests to confirm they pass**

```bash
python -m pytest tests/test_database_ssl.py -v
```

Expected: all 3 tests PASS.

- [ ] **Step 6: Run full test suite to check no regressions**

```bash
python -m pytest --tb=short -q 2>&1 | tail -20
```

Expected: same pass/fail count as before this change (only new tests added).

- [ ] **Step 7: Commit**

```bash
git add src/models/base.py .env.example tests/test_database_ssl.py
git commit -m "feat: add DATABASE_SSL toggle for Supabase postgres connection"
```

---

### Task 2: Configure .env and verify Supabase connection

> This task is manual — you perform it, not the agent.

**Files:**
- Modify: `.env` (your local file, not committed)

- [ ] **Step 1: Get your Supabase connection string**

In your Supabase dashboard → Project Settings → Database → Connection string → **Session mode** (port 5432). Copy the `postgresql://...` URI.

- [ ] **Step 2: Update `.env`**

```
DATABASE_URL=postgresql+asyncpg://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:5432/postgres
DATABASE_SSL=true
```

- [ ] **Step 3: Initialize schema on Supabase**

```bash
python -m scripts.db.init_db
```

Expected: pgvector extension created, all tables created (no errors).

- [ ] **Step 4: Optionally seed demo data**

```bash
python -m scripts.db.seed.seed
```

Expected: demo patients, visits, and departments created using Supabase-hosted MRI URLs.

- [ ] **Step 5: Start the API and verify**

```bash
uvicorn src.api.server:app --reload
curl http://localhost:8000/api/patients | python -m json.tool
```

Expected: JSON list of patients (empty `[]` on fresh DB, or seeded data if Step 4 was run).
