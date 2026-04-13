"""Tests for DATABASE_SSL env var wiring in base.py engine creation."""
import importlib
import sys
import os
import pytest


def _reload_base(monkeypatch, database_url: str, ssl: str):
    """Reload src.models.base with patched env vars."""
    monkeypatch.setenv("DATABASE_URL", database_url)
    monkeypatch.setenv("DATABASE_SSL", ssl)
    # Remove cached module via monkeypatch so sys.modules is restored on teardown
    for key in list(sys.modules.keys()):
        if "src.models.base" in key:
            monkeypatch.delitem(sys.modules, key)
    return importlib.import_module("src.models.base")


def test_ssl_disabled_async_connect_args(monkeypatch):
    """When DATABASE_SSL=false, async args must have statement_cache_size=0 and a unique name func."""
    base = _reload_base(
        monkeypatch,
        "postgresql+asyncpg://postgres:postgres@localhost:5432/medinexus",
        "false",
    )
    assert base._async_connect_args["statement_cache_size"] == 0
    assert callable(base._async_connect_args["prepared_statement_name_func"])
    assert "ssl" not in base._async_connect_args


def test_ssl_disabled_sync_no_connect_args(monkeypatch):
    """When DATABASE_SSL=false, sync engine must have no ssl connect_args."""
    base = _reload_base(
        monkeypatch,
        "postgresql+asyncpg://postgres:postgres@localhost:5432/medinexus",
        "false",
    )
    assert base._sync_connect_args == {}


def test_ssl_enabled_async_connect_args(monkeypatch):
    """When DATABASE_SSL=true, async args must include ssl=True, statement_cache_size=0, and name func."""
    base = _reload_base(
        monkeypatch,
        "postgresql+asyncpg://postgres:pass@db.abc.supabase.co:5432/postgres",
        "true",
    )
    assert base._async_connect_args["ssl"] is True
    assert base._async_connect_args["statement_cache_size"] == 0
    assert callable(base._async_connect_args["prepared_statement_name_func"])


def test_ssl_enabled_sync_connect_args(monkeypatch):
    """When DATABASE_SSL=true, sync engine must have sslmode=require in connect_args."""
    base = _reload_base(
        monkeypatch,
        "postgresql+asyncpg://postgres:pass@db.abc.supabase.co:5432/postgres",
        "true",
    )
    assert base._sync_connect_args == {"sslmode": "require"}
