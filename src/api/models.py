from typing import Optional, List
from pydantic import BaseModel
from datetime import datetime

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
    imaging: Optional[list] = []
    image_groups: Optional[list] = []
    health_summary: Optional[str] = None
    health_summary_updated_at: Optional[str] = None
    health_summary_status: Optional[str] = None
    health_summary_task_id: Optional[str] = None

class ImagingResponse(BaseModel):
    id: int
    patient_id: int
    title: str
    image_type: str
    original_url: str
    preview_url: str
    group_id: Optional[int] = None
    created_at: str

class ImageGroupResponse(BaseModel):
    id: int
    patient_id: int
    name: str
    created_at: str

class ImageGroupCreate(BaseModel):
    name: str

class ImagingCreate(BaseModel):
    title: str
    image_type: str
    preview_url: str
    original_url: str
    group_id: Optional[int] = None



class HealthSummaryResponse(BaseModel):
    """Health summary generation response."""
    patient_id: int
    health_summary: Optional[str] = None
    health_summary_updated_at: Optional[str] = None
    status: str = "pending"  # 'pending' | 'generating' | 'completed' | 'error'
    task_id: Optional[str] = None  # Celery task ID for async tracking


class ToolCreate(BaseModel):
    """Create tool request."""
    name: str
    symbol: str  # snake_case identifier
    description: str
    tool_type: str = "function"  # 'function' or 'api'
    code: Optional[str] = None  # For function type
    api_endpoint: Optional[str] = None  # For api type
    api_request_payload: Optional[str] = None  # JSON schema for request
    api_request_example: Optional[str] = None  # JSON example for request
    api_response_payload: Optional[str] = None  # JSON schema for response
    api_response_example: Optional[str] = None  # JSON example for response
    enabled: bool = False
    test_passed: bool = False
    scope: str = "assignable"  # Default to assignable for custom tools

class ToolUpdate(BaseModel):
    """Update tool request."""
    description: Optional[str] = None
    tool_type: Optional[str] = None
    code: Optional[str] = None
    api_endpoint: Optional[str] = None
    api_request_payload: Optional[str] = None
    api_request_example: Optional[str] = None
    api_response_payload: Optional[str] = None
    api_response_example: Optional[str] = None
    enabled: Optional[bool] = None
    test_passed: Optional[bool] = None

class ToolTestRequest(BaseModel):
    """Test tool request."""
    tool_type: str = "function"  # 'function' or 'api'
    code: Optional[str] = None  # For function type
    api_endpoint: Optional[str] = None  # For api type
    api_request_payload: Optional[str] = None  # JSON schema for request
    arguments: dict = {}  # Input arguments for the tool

class ToolTestResponse(BaseModel):
    """Test tool response."""
    result: Optional[str] = None
    error: Optional[str] = None
    status: str = "success"  # 'success' or 'error'

class ChatRequest(BaseModel):
    """Chat request model."""
    message: str
    user_id: Optional[str] = "default"
    stream: Optional[bool] = False
    patient_id: Optional[int] = None
    record_id: Optional[int] = None
    session_id: Optional[int] = None
    agent_role: Optional[str] = None

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
    tools: Optional[List[str]] = None  # Tool symbols for core agents

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
    id: int
    name: str
    symbol: str
    description: str
    tool_type: str
    code: Optional[str] = None
    api_endpoint: Optional[str] = None
    api_request_payload: Optional[str] = None
    api_request_example: Optional[str] = None
    api_response_payload: Optional[str] = None
    api_response_example: Optional[str] = None
    enabled: bool
    test_passed: bool
    scope: str
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
    patient_references: Optional[str] = None
    created_at: str
    # Background task fields
    status: Optional[str] = "completed"  # 'pending', 'streaming', 'completed', 'error', 'interrupted'
    task_id: Optional[str] = None
    logs: Optional[str] = None
    streaming_started_at: Optional[str] = None
    completed_at: Optional[str] = None
    error_message: Optional[str] = None
    last_updated_at: Optional[str] = None
    token_usage: Optional[str] = None  # JSON string of token usage

class ChatSessionCreate(BaseModel):
    """Create chat session request."""
    title: str
    agent_id: Optional[int] = None

class TaskStatusResponse(BaseModel):
    """Task status response model."""
    task_id: str
    status: str  # 'PENDING', 'STARTED', 'SUCCESS', 'FAILURE', 'RETRY'
    message_id: int
    content_preview: Optional[str] = None
    error: Optional[str] = None
    result: Optional[dict] = None

class ChatTaskResponse(BaseModel):
    """Chat task dispatch response."""
    task_id: str
    message_id: int
    session_id: int
    status: str = "pending"


# --- Visit schemas ---

class VisitCreate(BaseModel):
    """Request body for creating a new visit."""
    patient_id: int

class VisitRouteUpdate(BaseModel):
    """Request body for doctor routing approval."""
    routing_decision: list[str]
    reviewed_by: str

class VisitTransferRequest(BaseModel):
    target_department: str

class ClinicalNotesUpdate(BaseModel):
    """Request body for updating clinical notes on a visit."""
    clinical_notes: str
    assigned_doctor: Optional[str] = None

class VisitResponse(BaseModel):
    """Visit response for list and detail views."""
    id: int
    visit_id: str
    patient_id: int
    status: str
    confidence: Optional[float] = None
    routing_suggestion: Optional[list[str]] = None
    routing_decision: Optional[list[str]] = None
    chief_complaint: Optional[str] = None
    intake_session_id: Optional[int] = None
    reviewed_by: Optional[str] = None
    current_department: Optional[str] = None
    queue_position: Optional[int] = None
    clinical_notes: Optional[str] = None
    assigned_doctor: Optional[str] = None
    urgency_level: Optional[str] = None
    created_at: str
    updated_at: str

class VisitListResponse(VisitResponse):
    """Visit response for list view — includes patient_name, urgency, and wait time."""
    patient_name: str = "Unknown"
    wait_minutes: int = 0

class VisitDetailResponse(VisitResponse):
    """Extended visit response with patient info and intake notes."""
    patient_name: str
    patient_dob: str
    patient_gender: str
    intake_notes: Optional[str] = None


# --- Department schemas ---

class DepartmentResponse(BaseModel):
    name: str
    label: str
    capacity: int
    is_open: bool
    color: str
    icon: str
    current_patient_count: int = 0
    queue_length: int = 0
    status: str = "IDLE"

class DepartmentUpdate(BaseModel):
    capacity: int | None = None
    is_open: bool | None = None
