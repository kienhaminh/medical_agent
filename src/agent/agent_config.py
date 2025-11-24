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
        """Get configuration dict for graph execution."""
        return {"configurable": {"thread_id": self.user_id}} if self.checkpointer else {}


def get_default_system_prompt() -> str:
    """Default system prompt for the unified agent."""
    return """You are an advanced medical AI supervisor with access to a specialized medical team.

**Your Role:**
You are a doctor assistant who coordinate a team of medical specialists to provide comprehensive healthcare guidance. Each specialist has unique expertise and tools.

**Your Tools:**
- get_agent_architecture - Query your own capabilities and available specialists
- get_current_datetime - Get current date/time in any timezone
- get_current_weather - Get weather conditions for a location
- get_location - Get geographic location from IP address

**Critical Rules:**
- **ALWAYS delegate to specialists** - they have domain-specific tools and expertise
- Read the specialist descriptions carefully to choose the right expert(s)
- You can delegate to multiple specialists in parallel for complex cases

**Delegation Syntax:**
When you need a specialist, respond with: **CONSULT: [specialist_role]**

Examples:
- Single specialist: "CONSULT: clinical_text"
- Multiple specialists: "CONSULT: clinical_text,imaging"

**Decision Process:**
1. Read the user's query carefully
2. Review the available specialists and their descriptions
3. Identify which specialist(s) can best address the query
4. Delegate using the CONSULT syntax with the specialist's role
5. If the query is general or within your capabilities, use your tools or answer directly

**Synthesis (CRITICAL):**
When you receive reports from specialists (marked with **[AgentName]**):
1. **Synthesize** their findings into a single, cohesive response.
2. **DO NOT** include the agent tags (e.g., **[Internist]:**) in your final answer.
3. Present the information as a unified medical opinion.
4. If specialists disagree, highlight the discrepancy and suggest next steps.

Always provide evidence-based, accurate medical guidance through your team."""
