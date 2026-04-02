"""API dependencies — single shared agent instance."""

import logging
from ..agent.definition import LangGraphAgent
from ..llm.kimi import KimiProvider
from ..llm.openai_provider import OpenAIProvider
from ..config.settings import load_config
from ..tools.registry import ToolRegistry
from ..prompt.intake import INTAKE_SYSTEM_PROMPT

logger = logging.getLogger(__name__)

# Initialize ToolRegistry (singleton)
tool_registry = ToolRegistry()

# Initialize LLM provider
config = load_config()

if config.provider == "openai":
    provider_name = "OpenAI"
    llm_provider = OpenAIProvider(
        api_key=config.openai_api_key,
        model=config.model,
        temperature=config.temperature,
        streaming=True,
    )
else:
    provider_name = "Moonshot Kimi"
    llm_provider = KimiProvider(
        api_key=config.kimi_api_key,
        model=config.model,
        temperature=config.temperature,
        streaming=True,
    )

# Single shared agent — stateless, no per-user config
_agent: LangGraphAgent = LangGraphAgent(llm_with_tools=llm_provider.llm)
logger.info("Global agent initialized (%s)", provider_name)

# Intake agent with patient-facing system prompt
_intake_agent: LangGraphAgent = LangGraphAgent(
    llm_with_tools=llm_provider.llm,
    system_prompt=INTAKE_SYSTEM_PROMPT,
)
logger.info("Intake agent initialized (%s)", provider_name)


def get_agent() -> LangGraphAgent:
    """Return the global agent instance."""
    return _agent


def get_or_create_agent(user_id: str = None) -> LangGraphAgent:
    """Compatibility shim — user_id is ignored, returns the global agent."""
    return _agent


def get_intake_agent() -> LangGraphAgent:
    """Return the intake-mode agent (patient-facing system prompt)."""
    return _intake_agent
