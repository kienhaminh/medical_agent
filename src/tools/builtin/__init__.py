"""Built-in tools for AI agent.

This module imports all builtin tool modules to ensure they are registered
in the ToolRegistry singleton. Each tool module registers itself at import time.
"""

# Import modules (not just functions) to trigger registration
from . import datetime_tool
from . import location_tool
from . import weather_tool
from . import meta_tool
from . import patient_basic_info_tool
from . import patient_medical_records_tool
from . import patient_imaging_tool
from . import agent_info_tool
from . import tool_search  # Tool discovery to save prompt tokens
from . import semantic_tool_search  # Vector-based semantic search
from . import complete_triage_tool
from . import find_patient_tool
from . import create_patient_tool
from . import create_visit_tool

# Also import the functions for convenience
from .datetime_tool import get_current_datetime
from .location_tool import get_location
from .weather_tool import get_current_weather
from .meta_tool import create_new_tool
from .patient_basic_info_tool import query_patient_basic_info
from .patient_medical_records_tool import query_patient_medical_records
from .patient_imaging_tool import query_patient_imaging
from .agent_info_tool import get_agent_architecture
from .tool_search import search_tools, get_tool_info, list_available_tools
from .semantic_tool_search import search_tools_semantic, index_all_tools, get_search_stats
from .complete_triage_tool import complete_triage
from .find_patient_tool import find_patient
from .create_patient_tool import create_patient

__all__ = [
    "get_current_datetime",
    "get_location",
    "get_current_weather",
    "create_new_tool",
    "query_patient_basic_info",
    "query_patient_medical_records",
    "query_patient_imaging",
    "get_agent_architecture",
    "search_tools",  # Tool discovery
    "get_tool_info",
    "list_available_tools",
    "search_tools_semantic",  # Semantic search
    "index_all_tools",
    "get_search_stats",
    "complete_triage",
    "find_patient",
    "create_patient",
]
