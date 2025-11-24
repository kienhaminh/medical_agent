import os
import yaml
from typing import Dict, Optional
from pathlib import Path
from dotenv import load_dotenv
from ..agent.langgraph_agent import LangGraphAgent
from ..llm.kimi import KimiProvider
from ..config.settings import load_config
from ..memory import Mem0MemoryManager
from ..tools.registry import ToolRegistry

# Load environment variables
load_dotenv()

# Load memory configuration
def load_memory_config() -> Optional[Dict]:
    """Load memory configuration from YAML file."""
    config_path = Path(__file__).parent.parent.parent / "config" / "memory.yaml"
    if config_path.exists():
        with open(config_path, "r") as f:
            return yaml.safe_load(f)
    return None

# Initialize memory manager
memory_manager = None
memory_config = load_memory_config()

if memory_config and memory_config.get("memory", {}).get("enabled", False):
    try:
        long_term_config = memory_config["memory"]["long_term"]["mem0"]
        memory_manager = Mem0MemoryManager(config=long_term_config)
        print("Memory manager initialized successfully")
    except Exception as e:
        print(f"Warning: Failed to initialize memory manager: {e}")

# Initialize ToolRegistry (Singleton)
tool_registry = ToolRegistry()

# Initialize LLM provider (Enforce Kimi)
config = load_config()
provider_name = "Moonshot Kimi (LangGraph)"

llm_provider = KimiProvider(
    api_key=config.kimi_api_key,
    model="kimi-k2-thinking", # Enforce k2 thinking model
    temperature=0.3,
)

# User-specific agents
user_agents: Dict = {}

def get_or_create_agent(user_id: str):
    """Get or create agent for user."""
    if user_id not in user_agents:
        # Use default system prompt from agent_config.py
        # This prompt includes delegation instructions for sub-agents
        # DO NOT override with environment variable as it breaks delegation

        # Create LangGraph agent
        user_agents[user_id] = LangGraphAgent(
            llm_with_tools=llm_provider.llm,  # Pass the LangChain LLM
            memory_manager=memory_manager,
            user_id=user_id,
            # system_prompt defaults to get_default_system_prompt() in LangGraphAgent.__init__
        )

    return user_agents[user_id]
