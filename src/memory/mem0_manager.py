"""Mem0-based memory manager for agent long-term memory."""

import logging
from typing import List, Dict, Any, Optional
from datetime import datetime
from mem0 import Memory


logger = logging.getLogger(__name__)


class Mem0MemoryManager:
    """Manages long-term agent memory using Mem0."""

    def __init__(self, config: Optional[Dict[str, Any]] = None):
        """Initialize Mem0 memory manager.

        Args:
            config: Memory configuration dict containing mem0 settings
        """
        if Memory is None:
            raise ImportError(
                "mem0ai package not installed. Run: pip install mem0ai"
            )

        self.config = config or {}
        self._initialize_memory()

    def _initialize_memory(self):
        """Initialize Mem0 memory instance."""
        try:
            # Build Mem0 configuration
            mem0_config = {}

            # Graph store configuration
            if "graph_store" in self.config:
                mem0_config["graph_store"] = self.config["graph_store"]

            # Vector embeddings configuration
            if "embeddings" in self.config:
                embeddings_provider = self.config["embeddings"].get("provider", "openai")
                embeddings_model = self.config["embeddings"].get("model", "text-embedding-3-small")
                
                # Set default embedding dimensions based on provider and model
                embedding_dims = 768  # Default for Gemini text-embedding-004
                if embeddings_provider == "openai":
                    if "text-embedding-3-large" in embeddings_model:
                        embedding_dims = 3072
                    elif "text-embedding-3-small" in embeddings_model:
                        embedding_dims = 1536
                
                mem0_config["embedder"] = {
                    "provider": embeddings_provider,
                    "config": {
                        "model": embeddings_model,
                        "embedding_dims": embedding_dims,
                    },
                }

            # LLM configuration for fact extraction
            if "llm" in self.config:
                mem0_config["llm"] = {
                    "provider": self.config["llm"].get("provider", "openai"),
                    "config": {
                        "model": self.config["llm"].get(
                            "model", "gpt-4.1-nano-2025-04-14"
                        )
                    },
                }

            logger.info("Initializing Mem0 with config: %s", mem0_config)
            self.memory = Memory.from_config(mem0_config)
            logger.info("Mem0 memory manager initialized successfully")

        except Exception as e:
            logger.error(f"Failed to initialize Mem0: {e}")
            raise

    def add_conversation(
        self, user_id: str, messages: List[Dict[str, str]], metadata: Optional[Dict] = None
    ) -> Dict[str, Any]:
        """Store conversation in long-term memory.

        Args:
            user_id: Unique user identifier
            messages: List of message dicts with role and content
            metadata: Optional metadata to attach

        Returns:
            Dict with results from Mem0
        """
        try:
            # Add metadata with timestamp
            full_metadata = metadata or {}
            full_metadata["timestamp"] = datetime.now().isoformat()
            full_metadata["user_id"] = user_id

            # Store in Mem0
            result = self.memory.add(messages, user_id=user_id, metadata=full_metadata)

            logger.debug(
                f"Added conversation for user {user_id}: {len(messages)} messages"
            )
            return result

        except Exception as e:
            logger.error(f"Failed to add conversation to memory: {e}")
            return {"error": str(e)}

    def search_memories(
        self,
        query: str,
        user_id: str,
        limit: int = 5,
        filters: Optional[Dict] = None,
    ) -> List[str]:
        """Search for relevant memories.

        Args:
            query: Search query
            user_id: User identifier
            limit: Maximum number of results
            filters: Optional filters for search

        Returns:
            List of relevant memory strings
        """
        try:
            # Search Mem0
            results = self.memory.search(
                query=query, user_id=user_id, limit=limit, filters=filters
            )

            # Extract memory content
            memories = []
            if results and "results" in results:
                for result in results["results"]:
                    if isinstance(result, dict) and "memory" in result:
                        memories.append(result["memory"])
                    elif isinstance(result, str):
                        memories.append(result)

            logger.debug(f"Found {len(memories)} memories for query: {query}")
            return memories

        except Exception as e:
            logger.error(f"Failed to search memories: {e}")
            return []

    def get_all_memories(self, user_id: str) -> List[Dict[str, Any]]:
        """Get all memories for a user.

        Args:
            user_id: User identifier

        Returns:
            List of memory dicts
        """
        try:
            results = self.memory.get_all(user_id=user_id)
            logger.debug(f"Retrieved {len(results)} memories for user {user_id}")
            return results

        except Exception as e:
            logger.error(f"Failed to get all memories: {e}")
            return []

    def delete_memory(self, memory_id: str) -> bool:
        """Delete a specific memory.

        Args:
            memory_id: Memory identifier

        Returns:
            True if deleted successfully
        """
        try:
            self.memory.delete(memory_id=memory_id)
            logger.info(f"Deleted memory: {memory_id}")
            return True

        except Exception as e:
            logger.error(f"Failed to delete memory {memory_id}: {e}")
            return False

    def delete_user_memories(self, user_id: str) -> bool:
        """Delete all memories for a user (GDPR right to erasure).

        Args:
            user_id: User identifier

        Returns:
            True if deleted successfully
        """
        try:
            self.memory.delete_all(user_id=user_id)
            logger.info(f"Deleted all memories for user: {user_id}")
            return True

        except Exception as e:
            logger.error(f"Failed to delete user memories: {e}")
            return False

    def update_memory(
        self, memory_id: str, data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Update a specific memory.

        Args:
            memory_id: Memory identifier
            data: Updated memory data

        Returns:
            Updated memory dict
        """
        try:
            result = self.memory.update(memory_id=memory_id, data=data)
            logger.info(f"Updated memory: {memory_id}")
            return result

        except Exception as e:
            logger.error(f"Failed to update memory {memory_id}: {e}")
            return {"error": str(e)}

    def get_memory_stats(self, user_id: str) -> Dict[str, Any]:
        """Get memory statistics for a user.

        Args:
            user_id: User identifier

        Returns:
            Dict with memory statistics
        """
        try:
            all_memories = self.get_all_memories(user_id)

            return {
                "user_id": user_id,
                "total_memories": len(all_memories),
                "last_updated": (
                    max(
                        (m.get("created_at") for m in all_memories if "created_at" in m),
                        default=None,
                    )
                    if all_memories
                    else None
                ),
            }

        except Exception as e:
            logger.error(f"Failed to get memory stats: {e}")
            return {
                "user_id": user_id,
                "total_memories": 0,
                "error": str(e),
            }

    def reset(self):
        """Reset memory instance (for testing)."""
        try:
            self._initialize_memory()
            logger.info("Memory manager reset")
        except Exception as e:
            logger.error(f"Failed to reset memory manager: {e}")

    def __repr__(self) -> str:
        """String representation."""
        return f"Mem0MemoryManager(config={self.config})"
