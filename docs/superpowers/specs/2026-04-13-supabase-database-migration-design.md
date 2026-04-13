# Supabase Database Migration Design

**Date:** 2026-04-13  
**Status:** Approved

## Summary

Point the backend's PostgreSQL connection at Supabase's managed Postgres. File storage (MRI images) is already on Supabase Storage. This completes the migration: all data lives in Supabase.

## What Changes

### 1. `src/models/base.py` — SSL support for both engines

Supabase requires SSL for external connections. asyncpg and psycopg2 each need `connect_args` to enable it.

- Read `DATABASE_SSL` env var (default: `false`)
- When `DATABASE_SSL=true`:
  - Async engine: `connect_args={"ssl": True}`
  - Sync engine: `connect_args={"sslmode": "require"}`
- When `DATABASE_SSL=false`: no connect_args (local Postgres dev still works)

### 2. `.env.example` — Document Supabase connection format

Add Supabase connection string format and `DATABASE_SSL=true` alongside existing `SUPABASE_URL`/`SUPABASE_KEY` vars.

```
DATABASE_URL=postgresql+asyncpg://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres
DATABASE_SSL=true
```

> Note: Use Supabase's **Session Mode** pooler (port 6543) for SQLAlchemy compatibility, or the direct connection (port 5432). Avoid Transaction Mode (port 6543 default pgBouncer) as it conflicts with prepared statements.

## What Doesn't Change

- All SQLAlchemy models, relationships, and queries
- All API routes and business logic
- Alembic migrations (run against Supabase on first deploy)
- Seed script (already uses Supabase Storage URLs for MRI files)
- `init_db()` startup logic (pgvector is pre-installed in Supabase)

## Schema Setup (one-time)

On first deploy against Supabase:
1. Set `DATABASE_URL` and `DATABASE_SSL=true` in `.env`
2. App startup runs `init_db()` → creates pgvector extension + all tables
3. Optionally run `python -m scripts.db.seed.seed` for demo data

## Risk

**Low.** Supabase is standard Postgres 15+. The only net-new code is the SSL connect_args toggle — everything else is configuration.
