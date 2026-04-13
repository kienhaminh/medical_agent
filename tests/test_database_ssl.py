"""Tests for DATABASE_SSL env var wiring in base.py engine creation."""
import importlib
import sys
import os
import pytest


def _reload_base(monkeypatch, database_url: str, ssl: str):
    """Reload src.models.base with patched env vars."""
    monkeypatch.setenv("DATABASE_URL", database_url)
    monkeypatch.setenv("DATABASE_SSL", ssl)
    # Remove cached module so env vars are re-read on import
    for key in list(sys.modules.keys()):
        if "src.models.base" in key:
            del sys.modules[key]
    return importlib.import_module("src.models.base")


def test_ssl_disabled_async_no_connect_args(monkeypatch):
    """When DATABASE_SSL=false, async engine must have no ssl connect_args."""
    base = _reload_base(
        monkeypatch,
        "postgresql+asyncpg://postgres:postgres@localhost:5432/medinexus",
        "false",
    )
    # _async_connect_args should be empty dict
    assert base._async_connect_args == {}


def test_ssl_disabled_sync_no_connect_args(monkeypatch):
    """When DATABASE_SSL=false, sync engine must have no ssl connect_args."""
    base = _reload_base(
        monkeypatch,
        "postgresql+asyncpg://postgres:postgres@localhost:5432/medinexus",
        "false",
    )
    assert base._sync_connect_args == {}


def test_ssl_enabled_async_connect_args(monkeypatch):
    """When DATABASE_SSL=true, async engine must have ssl=True in connect_args."""
    base = _reload_base(
        monkeypatch,
        "postgresql+asyncpg://postgres:pass@db.abc.supabase.co:5432/postgres",
        "true",
    )
    assert base._async_connect_args == {"ssl": True}


def test_ssl_enabled_sync_connect_args(monkeypatch):
    """When DATABASE_SSL=true, sync engine must have sslmode=require in connect_args."""
    base = _reload_base(
        monkeypatch,
        "postgresql+asyncpg://postgres:pass@db.abc.supabase.co:5432/postgres",
        "true",
    )
    assert base._sync_connect_args == {"sslmode": "require"}
