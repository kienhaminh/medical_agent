"""Generic in-memory vault — stores temporary data behind opaque keys."""

from ._store import VaultStore, VaultEntry, DEFAULT_TTL_SECONDS

__all__ = ["VaultStore", "VaultEntry", "DEFAULT_TTL_SECONDS"]
