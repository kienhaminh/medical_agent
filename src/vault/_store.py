"""Generic in-memory vault store with TTL-based expiry.

Stores arbitrary key-value data behind opaque UUID keys. Designed so that
LLM agents never see raw data — they only receive and pass around vault keys.

Single-process only (same caveat as FormRequestRegistry).
"""

import time
import uuid
import logging
from dataclasses import dataclass, field
from typing import Optional

logger = logging.getLogger(__name__)

# Default time-to-live for vault entries (30 minutes).
DEFAULT_TTL_SECONDS = 1800.0


@dataclass
class VaultEntry:
    """A single vault record."""

    entry_type: str
    data: dict[str, str]
    created_at: float = field(default_factory=time.time)
    ttl_seconds: float = DEFAULT_TTL_SECONDS

    def is_expired(self) -> bool:
        return (time.time() - self.created_at) > self.ttl_seconds


class VaultStore:
    """Singleton in-memory store keyed by opaque UUIDs.

    Usage::

        vault = VaultStore()
        key = vault.store("patient", {"first_name": "Jane", "dob": "1990-01-01"})
        entry = vault.get(key)   # VaultEntry or None
        vault.remove(key)
    """

    _instance: Optional["VaultStore"] = None
    _entries: dict[str, VaultEntry]

    def __new__(cls) -> "VaultStore":
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._entries = {}
        return cls._instance

    def store(
        self,
        entry_type: str,
        data: dict[str, str],
        ttl_seconds: float = DEFAULT_TTL_SECONDS,
    ) -> str:
        """Deposit data and return an opaque vault key (UUID)."""
        self._cleanup()
        key = str(uuid.uuid4())
        self._entries[key] = VaultEntry(
            entry_type=entry_type,
            data=data,
            ttl_seconds=ttl_seconds,
        )
        logger.info("vault.store: type=%s key=%s", entry_type, key)
        return key

    def get(self, vault_key: str) -> Optional[VaultEntry]:
        """Return the entry if it exists and has not expired, else None."""
        entry = self._entries.get(vault_key)
        if entry is None:
            return None
        if entry.is_expired():
            del self._entries[vault_key]
            logger.debug("vault.get: key=%s expired, removed", vault_key)
            return None
        return entry

    def remove(self, vault_key: str) -> None:
        """Explicitly remove an entry."""
        self._entries.pop(vault_key, None)

    def _cleanup(self) -> None:
        """Lazy prune of all expired entries."""
        expired = [k for k, v in self._entries.items() if v.is_expired()]
        for k in expired:
            del self._entries[k]
        if expired:
            logger.debug("vault._cleanup: pruned %d expired entries", len(expired))
