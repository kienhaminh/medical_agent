"""API dependencies — shared agent instances.

Model routing:
  - Intake agent  → OpenAI gpt-5.4-nano (fast tool calling, low latency)
  - Doctor agent  → Kimi kimi-k2.5 (deep reasoning, extended thinking for clinical support)

Override models via env vars: OPENAI_MODEL, KIMI_MODEL
"""

import os
import logging
from ..agent.definition import LangGraphAgent
from ..llm.kimi import KimiProvider
from ..llm.openai_provider import OpenAIProvider
from ..config.settings import load_config
from ..tools.registry import ToolRegistry
from ..prompt.intake import build_intake_prompt
from ..prompt.system import build_system_prompt

logger = logging.getLogger(__name__)

# Initialize ToolRegistry (singleton)
tool_registry = ToolRegistry()

# Register all LangChain tools before building the graph (LangGraphAgent also imports this,
# but doing it here makes MCP-backed tools guaranteed available on first agent build).
import src.tools  # noqa: E402, F401

config = load_config()

# Per-agent model selection — override via env vars if needed
_OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-5.4-nano")
_KIMI_MODEL = os.getenv("KIMI_MODEL", "kimi-k2.5")
_KIMI_TEMPERATURE = 1.0  # kimi-k2.5 only supports temperature=1

# --- OpenAI provider (intake) ---
_openai_provider = OpenAIProvider(
    api_key=config.openai_api_key,
    model=_OPENAI_MODEL,
    temperature=config.temperature,
    streaming=True,
)
logger.info("OpenAI provider initialized (model=%s)", _OPENAI_MODEL)

# --- Kimi provider (doctor support) ---
_kimi_provider = KimiProvider(
    api_key=config.kimi_api_key,
    model=_KIMI_MODEL,
    temperature=_KIMI_TEMPERATURE,
    streaming=True,
)
logger.info("Kimi provider initialized (model=%s)", _KIMI_MODEL)

# Doctor support agent — full tool set, deep reasoning via kimi-k2.5
_agent: LangGraphAgent = LangGraphAgent(
    llm_with_tools=_kimi_provider.llm,
    system_prompt=build_system_prompt(config.language),
)
logger.info("Doctor agent initialized (Kimi %s)", _KIMI_MODEL)

# Tools needed by the intake agent — restrict to this set for faster tool
# selection and smaller prompt token count (no clinical/analysis tools needed).
_INTAKE_TOOLS = ["ask_user_input", "create_visit", "complete_triage", "set_itinerary"]

# Intake agent — fast GPT model with restricted tool set for low latency
_intake_agent: LangGraphAgent = LangGraphAgent(
    llm_with_tools=_openai_provider.llm,
    system_prompt=build_intake_prompt(config.language),
    allowed_tools=_INTAKE_TOOLS,
)
logger.info("Intake agent initialized (OpenAI %s)", _OPENAI_MODEL)


def get_agent() -> LangGraphAgent:
    """Return the doctor support agent (Kimi)."""
    return _agent


def get_intake_agent() -> LangGraphAgent:
    """Return the intake agent (OpenAI)."""
    return _intake_agent
