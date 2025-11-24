from typing import Optional, List
from pydantic import BaseModel

class PatientCreate(BaseModel):
    name: str
    dob: str
    gender: str

class PatientResponse(BaseModel):
    id: int
    name: str
    dob: str
    gender: str
    created_at: str

class PatientDetailResponse(BaseModel):
    id: int
    name: str
    dob: str
    gender: str
    created_at: str
    records: list

class ToolToggleRequest(BaseModel):
    enabled: bool

class ToolCreate(BaseModel):
    """Create tool request."""
    name: str
    description: str
    category: Optional[str] = "other"
    code: str = ""  # Empty code for custom tools
    scope: str = "assignable"  # Default to assignable for custom tools

class ToolUpdate(BaseModel):
    """Update tool request."""
    description: Optional[str] = None
    category: Optional[str] = None
    code: Optional[str] = None
    enabled: Optional[bool] = None

class ChatRequest(BaseModel):
    """Chat request model."""
    message: str
    user_id: Optional[str] = "default"
    stream: Optional[bool] = False
    patient_id: Optional[int] = None
    record_id: Optional[int] = None
    session_id: Optional[int] = None

class ChatResponse(BaseModel):
    """Chat response model."""
    content: str
    timestamp: str
    user_id: str
    session_id: int
    memories_used: Optional[int] = 0

class TextRecordCreate(BaseModel):
    title: str
    content: str
    description: Optional[str] = None

class RecordResponse(BaseModel):
    id: int
    patient_id: int
    record_type: str
    title: str
    description: Optional[str]
    content: Optional[str]
    file_url: Optional[str]
    file_type: Optional[str]
    created_at: str

# --- Agent Models ---

class SubAgentResponse(BaseModel):
    """Sub-agent response model."""
    id: int
    name: str
    role: str
    description: str
    system_prompt: str
    enabled: bool
    color: str
    icon: str
    is_template: bool
    parent_template_id: Optional[int]
    created_at: str
    updated_at: str

class SubAgentCreate(BaseModel):
    """Create sub-agent request."""
    name: str
    role: str
    description: str
    system_prompt: str
    color: str = "#06b6d4"
    icon: str = "Bot"
    is_template: bool = False
    parent_template_id: Optional[int] = None

class SubAgentUpdate(BaseModel):
    """Update sub-agent request."""
    name: Optional[str] = None
    role: Optional[str] = None
    description: Optional[str] = None
    system_prompt: Optional[str] = None
    color: Optional[str] = None
    icon: Optional[str] = None
    enabled: Optional[bool] = None

class ToggleRequest(BaseModel):
    """Toggle enabled status request."""
    enabled: bool

class AssignToolRequest(BaseModel):
    """Assign tool to agent request."""
    tool_name: str

class BulkToolsRequest(BaseModel):
    """Bulk update tool assignments request."""
    tool_names: list[str]

class AgentToolAssignmentResponse(BaseModel):
    """Agent-tool assignment response."""
    # id: int # Removed as assignment is not a separate entity
    agent_id: int
    tool_name: str
    # enabled: bool # specific assignment enabled status is removed
    # created_at: str

class ToolResponse(BaseModel):
    """Tool response model."""
    name: str
    description: str
    enabled: bool
    scope: str
    category: Optional[str]
    assigned_agent_id: Optional[int] = None

class ChatSessionResponse(BaseModel):
    """Chat session response model."""
    id: int
    title: str
    agent_id: Optional[int] = None
    agent_name: Optional[str] = None
    message_count: int
    preview: Optional[str] = None
    tags: Optional[list[str]] = None
    created_at: str
    updated_at: str

class ChatMessageResponse(BaseModel):
    """Chat message response model."""
    id: int
    session_id: int
    role: str
    content: str
    tool_calls: Optional[str] = None
    reasoning: Optional[str] = None
    created_at: str

class ChatSessionCreate(BaseModel):
    """Create chat session request."""
    title: str
    agent_id: Optional[int] = None
