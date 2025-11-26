"""Agent Configuration and Initialization.

Handles agent configuration, default prompts, and persistence setup.
"""

import os
from typing import Optional
from langgraph.checkpoint.postgres import PostgresSaver
from psycopg2.pool import SimpleConnectionPool


class AgentConfig:
    """Configuration for the LangGraph agent."""
    
    def __init__(
        self,
        user_id: str = "default",
        max_iterations: int = 10,
        max_concurrent_subagents: int = 5,
        subagent_timeout: float = 30.0,
        use_persistence: bool = False,
    ):
        """Initialize agent configuration.
        
        Args:
            user_id: User identifier for memory and persistence
            max_iterations: Maximum iterations for ReAct loop
            max_concurrent_subagents: Maximum concurrent sub-agent consultations
            subagent_timeout: Timeout in seconds for sub-agent consultations
            use_persistence: Whether to use Postgres persistence
        """
        self.user_id = user_id
        self.max_iterations = max_iterations
        self.max_concurrent_subagents = max_concurrent_subagents
        self.subagent_timeout = subagent_timeout
        self.use_persistence = use_persistence
        
        # Initialize persistence
        self.checkpointer = None
        self.pool = None
        if use_persistence:
            self._setup_persistence()
    
    def _setup_persistence(self) -> None:
        """Setup PostgreSQL persistence for the agent."""
        try:
            db_uri = os.getenv("POSTGRES_URI", "postgresql://postgres:postgres@localhost:5432/postgres")
            connection_kwargs = {
                "autocommit": True,
                "prepare_threshold": 0,
            }
            self.pool = SimpleConnectionPool(1, 1, dsn=db_uri, **connection_kwargs)
            self.checkpointer = PostgresSaver(self.pool)
            self.checkpointer.setup()
        except Exception as e:
            print(f"Failed to initialize persistence: {e}")
    
    def get_config(self) -> dict:
        """Get configuration dict for graph execution.

        Returns a config with recursion_limit to allow multiple tool calls.
        Each tool call loop is ~2 steps (agent → tools → agent), so we set
        recursion_limit to max_iterations * 3 to allow plenty of room.
        """
        config = {
            "recursion_limit": self.max_iterations * 3,  # Allow multiple tool invocations
        }

        if self.checkpointer:
            config["configurable"] = {"thread_id": self.user_id}

        return config
