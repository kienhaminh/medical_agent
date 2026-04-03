"""Tool system for AI Agent.

Provides infrastructure for registering, discovering, and executing tools
that extend agent capabilities with external functions.

Key Components:
    - ToolRegistry: Singleton registry for tool management
    - ToolPool: Pool for skill-organized tools
    - ToolExecutor: Safe tool execution with error handling
    - ToolResult: Standardized result format
"""

from .base import ToolResult
from .registry import ToolRegistry
from .executor import ToolExecutor
from .pool import ToolPool

# Import tool modules to trigger self-registration in ToolRegistry
from . import datetime_tool
from . import complete_triage_tool
from . import save_clinical_note_tool
from . import update_visit_status_tool
from . import create_visit_tool
from . import pre_visit_brief_tool
from . import differential_diagnosis_tool
from . import create_order_tool
from . import shift_handoff_tool
from . import ask_user_input_tool

# Patient tools (vault-mediated)
from . import deposit_patient_tool
from . import check_patient_tool
from . import compare_patient_tool
from . import register_patient_tool

# Re-export convenience functions
from .datetime_tool import get_current_datetime
from .complete_triage_tool import complete_triage
from .save_clinical_note_tool import save_clinical_note
from .update_visit_status_tool import update_visit_status
from .create_visit_tool import create_visit
from .pre_visit_brief_tool import pre_visit_brief
from .differential_diagnosis_tool import generate_differential_diagnosis
from .create_order_tool import create_order
from .shift_handoff_tool import generate_shift_handoff
from .ask_user_input_tool import ask_user_input
from .deposit_patient_tool import deposit_patient
from .check_patient_tool import check_patient
from .compare_patient_tool import compare_patient
from .register_patient_tool import register_patient

__all__ = [
    "ToolRegistry",
    "ToolPool",
    "ToolExecutor",
    "ToolResult",
    "get_current_datetime",
    "complete_triage",
    "save_clinical_note",
    "update_visit_status",
    "create_visit",
    "pre_visit_brief",
    "generate_differential_diagnosis",
    "create_order",
    "generate_shift_handoff",
    "ask_user_input",
    "deposit_patient",
    "check_patient",
    "compare_patient",
    "register_patient",
]
