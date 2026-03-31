# Agent Hardcode Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate DB-backed agent configuration by adding `RECEPTION_AGENT` to Python source, creating a static `agent_registry.py`, dropping the `sub_agents` table and related FKs, rewiring chat routing, and removing the agent management UI.

**Architecture:** All 6 agents are defined as dicts in `src/agent/core_agents.py` and accessed via `get_agent_config(role)` / `list_agents()` in `src/agent/agent_registry.py`. Chat sessions store `agent_role: str` (plain string, no FK) instead of `agent_id`. The `/api/agents` endpoint becomes read-only, serving the static registry. Agent management UI (create/edit/delete/assign) is deleted entirely.

**Tech Stack:** Python/SQLAlchemy/Alembic (backend), Next.js/TypeScript (frontend)

---

## File Map

| Action | File |
|--------|------|
| Modify | `src/agent/core_agents.py` |
| Create | `src/agent/agent_registry.py` |
| Create | `tests/test_agent_registry.py` |
| Create | `alembic/versions/<rev>_drop_sub_agents.py` |
| Modify | `src/models/chat.py` |
| Modify | `src/models/tool.py` |
| Modify | `src/models/skill.py` |
| Delete | `src/models/agent.py` |
| Modify | `src/models/__init__.py` |
| Modify | `src/config/database.py` |
| Modify | `src/api/models.py` |
| Rewrite | `src/api/routers/agents.py` |
| Modify | `src/api/routers/chat/messages.py` |
| Modify | `src/api/routers/chat/sessions.py` |
| Modify | `src/tasks/agent_tasks.py` |
| Modify | `src/agent/agent_loader.py` |
| Modify | `scripts/db/seed/seed_full_flow.py` |
| Rewrite | `web/components/agent/agent-card.tsx` |
| Modify | `web/components/sidebar.tsx` |
| Delete | `web/app/(dashboard)/agent/settings/page.tsx` |
| Delete | `web/app/(dashboard)/agent/tools/` (directory) |
| Delete | `web/components/agent/agents-tab.tsx` |
| Delete | `web/components/agent/tools-tab.tsx` |
| Delete | `web/components/agent/agent-form-dialog.tsx` |
| Delete | `web/components/agent/assignments-tab.tsx` |
| Delete | `web/components/agent/assignment-canvas.tsx` |
| Delete | `web/components/agent/assignment-visualization.tsx` |
| Delete | `web/components/agent/assignment-visualization-nodes.tsx` |
| Delete | `web/components/agent/tool-assignment-dialog.tsx` |
| Delete | `web/components/agent/use-agent-card.ts` |
| Delete | `web/components/agent/canvas/` (directory) |
| Delete | `web/components/agent/data.ts` |
| Delete | `web/components/agent/tools/` (directory) |
| Delete | `web/types/agent.ts` |

---

## Task 1: Add RECEPTION_AGENT and create agent_registry.py

**Files:**
- Modify: `src/agent/core_agents.py`
- Create: `src/agent/agent_registry.py`
- Create: `tests/test_agent_registry.py`

- [ ] **Step 1: Write the failing tests**

```python
# tests/test_agent_registry.py
"""Unit tests for agent_registry — must pass without any DB."""
import pytest

def test_get_agent_config_known_role():
    from src.agent.agent_registry import get_agent_config
    config = get_agent_config("reception_triage")
    assert config is not None
    assert config["role"] == "reception_triage"
    assert config["name"] == "Reception Triage"
    assert "system_prompt" in config
    assert len(config["system_prompt"]) > 100

def test_get_agent_config_unknown_role():
    from src.agent.agent_registry import get_agent_config
    assert get_agent_config("nonexistent_role") is None

def test_list_agents_returns_all_agents():
    from src.agent.agent_registry import list_agents
    agents = list_agents()
    roles = {a["role"] for a in agents}
    assert "reception_triage" in roles
    assert "doctor_assistant" in roles
    assert "clinical_text" in roles
    assert len(agents) == 6
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pytest tests/test_agent_registry.py -v
```
Expected: ImportError or 3 FAILs (module doesn't exist yet)

- [ ] **Step 3: Add RECEPTION_AGENT to `src/agent/core_agents.py`**

Open `src/agent/core_agents.py`. Add this constant before `CORE_AGENTS` (after the existing specialist agents):

```python
RECEPTION_AGENT = {
    "name": "Reception Triage",
    "role": "reception_triage",
    "description": (
        "Conducts patient intake interviews, collects chief complaints and symptoms, "
        "and generates triage assessments with department routing suggestions."
    ),
    "system_prompt": (
        "You are a hospital reception triage assistant. You conduct patient intake autonomously.\n\n"
        "**Your Role:** Check patients in using structured forms, create their visit record, "
        "and route them to the correct department.\n\n"
        "**CRITICAL — You MUST use tools to complete intake. Every patient must be registered and triaged.**\n\n"
        "**Intake Workflow:**\n"
        "1. Greet the patient warmly and let them know you will guide them through check-in\n"
        "2. **Immediately call `ask_user(template=\"patient_intake\")`** — this presents the full "
        "check-in form to the patient. Do NOT ask questions conversationally first.\n"
        "   - The tool returns: `intake_completed. patient_id=<N>, intake_id=<UUID>`\n"
        "   - Use `patient_id` for all subsequent tool calls — the patient record already exists\n"
        "3. Call `ask_user(template=\"confirm_visit\")` — ask the patient to confirm before proceeding\n"
        "   - If the tool returns `\"confirmed\"`: continue to step 4\n"
        "   - If the tool returns `\"declined\"`: thank the patient and end the session\n"
        "4. Create a visit using `create_visit(patient_id)` — note the visit ID returned\n"
        "5. Based on the chief complaint and symptoms collected by the form, "
        "determine the appropriate department and your confidence level\n"
        "6. Call `complete_triage(id, chief_complaint, intake_notes, routing_suggestion, confidence)` "
        "where `id` is the visit DB ID from step 4\n"
        "7. Inform the patient they have been checked in and will be directed to the appropriate department\n\n"
        "**EMERGENCIES (chest pain, difficulty breathing, severe bleeding, loss of consciousness):**\n"
        "- Still call `ask_user(template=\"patient_intake\")` — the form is fast\n"
        "- Skip the confirm_visit step and proceed directly to `create_visit` + `complete_triage`\n"
        "- Route to 'emergency' with confidence 0.95\n\n"
        "**If `ask_user` returns `\"form_timeout\"`:** "
        "Apologise and invite the patient to start over when ready.\n\n"
        "**Available Tools:**\n"
        "- `ask_user(template)` — Present a structured form to the patient and wait for their response\n"
        "  - `\"patient_intake\"` — Full check-in form (name, DOB, contact, symptoms, insurance, emergency contact). "
        "Returns `intake_completed. patient_id=<N>, intake_id=<UUID>`\n"
        "  - `\"confirm_visit\"` — Yes/no confirmation before creating a visit. "
        "Returns `\"confirmed\"` or `\"declined\"`\n"
        "- `create_visit(patient_id)` — Create a new visit (returns visit ID)\n"
        "- `complete_triage(id, chief_complaint, intake_notes, routing_suggestion, confidence)` — "
        "Finalize triage with routing\n\n"
        "**Available Departments:**\n"
        "emergency, cardiology, neurology, orthopedics, radiology, internal_medicine, "
        "general_checkup, dermatology, gastroenterology, pulmonology, endocrinology, "
        "ophthalmology, ent, urology\n\n"
        "**Routing Confidence Guide:**\n"
        "- 0.9-1.0: Clear, textbook presentation (chest pain → cardiology/emergency)\n"
        "- 0.7-0.89: Strong indication but some ambiguity\n"
        "- 0.5-0.69: Multiple departments possible, needs review\n"
        "- Below 0.5: Unclear, needs doctor review\n\n"
        "**Guidelines:**\n"
        "- **Never ask for information conversationally that the form already collects** — "
        "call `ask_user(template=\"patient_intake\")` immediately after your greeting\n"
        "- Be **empathetic and professional** — use simple, clear language\n"
        "- Do NOT provide diagnoses or medical advice — your job is to collect info and route\n"
        "- Call tools silently — do not describe tool calls to the patient\n"
        "- You will never see the patient's personal details — only their `patient_id` and `intake_id`\n"
        "- After completing triage, give patient a warm closing message with their department assignment"
    ),
    "color": "#14b8a6",
    "icon": "ClipboardList",
    "is_template": True,
    "tools": ["ask_user", "create_visit", "complete_triage"],
}
```

Then update the `CORE_AGENTS` list at the bottom of the file:

```python
CORE_AGENTS = [RECEPTION_AGENT, INTERNIST_AGENT, DOCTOR_AGENT, CARDIOLOGIST_AGENT, NEUROLOGIST_AGENT, PULMONOLOGIST_AGENT]
```

- [ ] **Step 4: Create `src/agent/agent_registry.py`**

```python
"""Static agent registry — resolves agent config by role string.

This is the single source of truth for agent system prompts and tool lists.
No DB queries. Import and call at any time.
"""
from typing import Optional
from .core_agents import CORE_AGENTS

_REGISTRY: dict[str, dict] = {agent["role"]: agent for agent in CORE_AGENTS}


def get_agent_config(role: str) -> Optional[dict]:
    """Return the agent config dict for a given role, or None if not found."""
    return _REGISTRY.get(role)


def list_agents() -> list[dict]:
    """Return all agent config dicts."""
    return list(_REGISTRY.values())
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
pytest tests/test_agent_registry.py -v
```
Expected: 3 PASSED

- [ ] **Step 6: Commit**

```bash
git add src/agent/core_agents.py src/agent/agent_registry.py tests/test_agent_registry.py
git commit -m "feat: add RECEPTION_AGENT and static agent_registry"
```

---

## Task 2: Alembic migration — transition chat_sessions, drop sub_agents

**Files:**
- Create: `alembic/versions/<rev>_drop_sub_agents.py`

- [ ] **Step 1: Generate empty migration file**

```bash
cd /Users/kien.ha/Code/medical_agent
alembic revision --message "drop_sub_agents_add_agent_role"
```

This creates a new file in `alembic/versions/`. Note the filename printed — it will look like `alembic/versions/XXXXXXXX_drop_sub_agents_add_agent_role.py`.

- [ ] **Step 2: Fill in the migration**

Open the generated file and replace the `upgrade()` and `downgrade()` functions:

```python
def upgrade() -> None:
    # 1. Add agent_role to chat_sessions
    op.add_column('chat_sessions', sa.Column('agent_role', sa.String(length=100), nullable=True))

    # 2. Migrate existing data: populate agent_role from sub_agents
    op.execute("""
        UPDATE chat_sessions
        SET agent_role = (
            SELECT role FROM sub_agents WHERE sub_agents.id = chat_sessions.agent_id
        )
        WHERE agent_id IS NOT NULL
    """)

    # 3. Drop agent_id from chat_sessions (drops FK constraint with it in PG)
    op.drop_column('chat_sessions', 'agent_id')

    # 4. Drop assigned_agent_id from tools (drops FK constraint with it in PG)
    op.drop_column('tools', 'assigned_agent_id')

    # 5. Drop agent_skills table (FK to both sub_agents and skills)
    op.drop_table('agent_skills')

    # 6. Drop sub_agents table (self-referential FK drops with it)
    op.drop_table('sub_agents')


def downgrade() -> None:
    # Recreate sub_agents
    op.create_table(
        'sub_agents',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(100), nullable=False),
        sa.Column('role', sa.String(50), nullable=False),
        sa.Column('description', sa.Text(), nullable=False),
        sa.Column('system_prompt', sa.Text(), nullable=False),
        sa.Column('enabled', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('color', sa.String(20), nullable=False),
        sa.Column('icon', sa.String(50), nullable=False),
        sa.Column('is_template', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('parent_template_id', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['parent_template_id'], ['sub_agents.id']),
        sa.UniqueConstraint('name'),
    )
    # Recreate agent_skills
    op.create_table(
        'agent_skills',
        sa.Column('agent_id', sa.Integer(), nullable=False),
        sa.Column('skill_id', sa.Integer(), nullable=False),
        sa.Column('assigned_at', sa.DateTime(), nullable=False),
        sa.Column('config', sa.JSON(), nullable=True),
        sa.ForeignKeyConstraint(['agent_id'], ['sub_agents.id']),
        sa.ForeignKeyConstraint(['skill_id'], ['skills.id']),
        sa.PrimaryKeyConstraint('agent_id', 'skill_id'),
    )
    # Restore assigned_agent_id on tools
    op.add_column('tools', sa.Column('assigned_agent_id', sa.Integer(), nullable=True))
    op.create_foreign_key(None, 'tools', 'sub_agents', ['assigned_agent_id'], ['id'])
    # Restore agent_id on chat_sessions
    op.add_column('chat_sessions', sa.Column('agent_id', sa.Integer(), nullable=True))
    op.create_foreign_key(None, 'chat_sessions', 'sub_agents', ['agent_id'], ['id'])
    # Drop agent_role from chat_sessions
    op.drop_column('chat_sessions', 'agent_role')
```

- [ ] **Step 3: Run the migration**

```bash
alembic upgrade head
```
Expected: `Running upgrade ... -> <rev>, drop_sub_agents_add_agent_role`

- [ ] **Step 4: Verify schema**

```bash
python -c "
import asyncio
from src.models.base import AsyncSessionLocal
from sqlalchemy import text

async def check():
    async with AsyncSessionLocal() as db:
        r = await db.execute(text(\"SELECT column_name FROM information_schema.columns WHERE table_name='chat_sessions'\"))
        cols = [row[0] for row in r.fetchall()]
        assert 'agent_role' in cols, 'agent_role missing'
        assert 'agent_id' not in cols, 'agent_id still present'
        print('Schema OK:', cols)

asyncio.run(check())
"
```
Expected: prints `Schema OK:` with `agent_role` present and `agent_id` absent.

- [ ] **Step 5: Commit**

```bash
git add alembic/versions/
git commit -m "feat: drop sub_agents table, add agent_role to chat_sessions"
```

---

## Task 3: Python model updates

**Files:**
- Modify: `src/models/chat.py`
- Modify: `src/models/tool.py`
- Modify: `src/models/skill.py`
- Delete: `src/models/agent.py`
- Modify: `src/models/__init__.py`
- Modify: `src/config/database.py`
- Modify: `src/api/models.py`

- [ ] **Step 1: Update `src/models/chat.py`**

Replace the file entirely with:

```python
"""ChatSession and ChatMessage models."""
from datetime import datetime
from typing import List, Optional

from sqlalchemy import DateTime, ForeignKey, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base


class ChatSession(Base):
    """Chat session model for storing conversation history."""
    __tablename__ = "chat_sessions"

    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String(200))
    agent_role: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=func.now(), onupdate=func.now())

    messages: Mapped[List["ChatMessage"]] = relationship(
        back_populates="session",
        cascade="all, delete-orphan",
        order_by="ChatMessage.created_at"
    )


class ChatMessage(Base):
    """Individual messages within a chat session."""
    __tablename__ = "chat_messages"

    id: Mapped[int] = mapped_column(primary_key=True)
    session_id: Mapped[int] = mapped_column(ForeignKey("chat_sessions.id", ondelete="CASCADE"), index=True)
    role: Mapped[str] = mapped_column(String(20))  # 'user', 'assistant', 'system'
    content: Mapped[str] = mapped_column(Text)
    tool_calls: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    reasoning: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    patient_references: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=func.now())

    # Background task execution fields
    status: Mapped[str] = mapped_column(String(20), default="completed")
    task_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    logs: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    streaming_started_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    error_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    token_usage: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    last_updated_at: Mapped[datetime] = mapped_column(DateTime, default=func.now(), onupdate=func.now())

    session: Mapped["ChatSession"] = relationship(back_populates="messages")
```

- [ ] **Step 2: Update `src/models/tool.py`**

Remove the `assigned_agent_id` column and `agent` relationship. Replace the file with:

```python
"""CustomTool model."""
from datetime import datetime
from typing import Optional

from sqlalchemy import Boolean, DateTime, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from .base import Base


class CustomTool(Base):
    """Custom tool model for storing user-defined tools."""
    __tablename__ = "tools"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100), unique=True)
    symbol: Mapped[str] = mapped_column(String(100), unique=True)
    description: Mapped[str] = mapped_column(Text)
    tool_type: Mapped[str] = mapped_column(String(20), default="function")
    code: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    api_endpoint: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    api_request_payload: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    api_request_example: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    api_response_payload: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    api_response_example: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    scope: Mapped[str] = mapped_column(String(20), default="global")
    enabled: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")
    test_passed: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=func.now())
```

- [ ] **Step 3: Update `src/models/skill.py`**

Remove the `AgentSkill` class and the `assigned_agents` relationship from `Skill`. Edit the file:

1. Delete the entire `AgentSkill` class (lines 134–142 in the original file).
2. Remove the `assigned_agents` relationship from `Skill` (lines 50–53 in original):
   ```python
   # DELETE these lines from Skill class:
   assigned_agents: Mapped[List["SubAgent"]] = relationship(
       secondary="agent_skills",
       back_populates="assigned_agents"
   )
   ```
3. Remove `"SubAgent"` from the `List` imports if it was included in skill.py (it shouldn't be since SubAgent is from agent.py, but verify).

The file after edits should have no reference to `SubAgent` or `agent_skills`.

- [ ] **Step 4: Delete `src/models/agent.py`**

```bash
rm src/models/agent.py
```

- [ ] **Step 5: Update `src/models/__init__.py`**

Remove `SubAgent` and `AgentSkill` references. Replace with:

```python
"""Models package - exports all database models."""
from .base import (
    Base,
    AsyncSessionLocal,
    SessionLocal,
    engine,
    sync_engine,
    get_db,
    init_db,
    DATABASE_URL,
    ASYNC_DATABASE_URL,
    SYNC_DATABASE_URL,
)
from .patient import Patient
from .intake_submission import IntakeSubmission
from .medical_record import MedicalRecord
from .imaging import Imaging, ImageGroup
from .chat import ChatSession, ChatMessage
from .tool import CustomTool
from .skill import Skill, SkillTool
from .visit import Visit, VisitStatus
from .case_thread import CaseThread, CaseMessage
from .department import Department
from .user import User, UserRole
from .order import Order, OrderType, OrderStatus

__all__ = [
    # Base
    "Base",
    "AsyncSessionLocal",
    "SessionLocal",
    "engine",
    "sync_engine",
    "get_db",
    "init_db",
    "DATABASE_URL",
    "ASYNC_DATABASE_URL",
    "SYNC_DATABASE_URL",
    # Models
    "Patient",
    "IntakeSubmission",
    "MedicalRecord",
    "Imaging",
    "ImageGroup",
    "ChatSession",
    "ChatMessage",
    "CustomTool",
    # Skill models
    "Skill",
    "SkillTool",
    # Visit models
    "Visit",
    "VisitStatus",
    # Case thread models
    "CaseThread",
    "CaseMessage",
    # Department models
    "Department",
    # User models
    "User",
    "UserRole",
    # Order models
    "Order",
    "OrderType",
    "OrderStatus",
]
```

- [ ] **Step 6: Update `src/config/database.py`**

Remove `SubAgent`, `AgentSkill` re-exports. Replace with:

```python
"""Database configuration - compatibility layer.

This module re-exports from src.models for backwards compatibility.
New code should import directly from src.models.
"""
from src.models import (
    Base,
    AsyncSessionLocal,
    SessionLocal,
    engine,
    sync_engine,
    get_db,
    init_db,
    DATABASE_URL,
    ASYNC_DATABASE_URL,
    SYNC_DATABASE_URL,
    Patient,
    MedicalRecord,
    Imaging,
    ImageGroup,
    ChatSession,
    ChatMessage,
    CustomTool,
    Skill,
    SkillTool,
)

# For backwards compatibility - Tool was renamed to CustomTool
Tool = CustomTool

__all__ = [
    "Base",
    "AsyncSessionLocal",
    "SessionLocal",
    "engine",
    "sync_engine",
    "get_db",
    "init_db",
    "DATABASE_URL",
    "ASYNC_DATABASE_URL",
    "SYNC_DATABASE_URL",
    "Patient",
    "MedicalRecord",
    "Imaging",
    "ImageGroup",
    "ChatSession",
    "ChatMessage",
    "CustomTool",
    "Tool",
    "Skill",
    "SkillTool",
]
```

- [ ] **Step 7: Update `src/api/models.py`**

Make four changes:

**a) Delete `SubAgentResponse`, `SubAgentCreate`, `SubAgentUpdate`, `ToggleRequest`, `AssignToolRequest`, `BulkToolsRequest`, `AgentToolAssignmentResponse` model classes** (they span approximately lines 147–202 in the original). The new `/api/agents` endpoint will return plain dicts serialized as JSON.

**b) Update `ChatSessionResponse`** — change `agent_id: Optional[int]` → `agent_role: Optional[str]` and remove `agent_name`:

```python
class ChatSessionResponse(BaseModel):
    """Chat session response model."""
    id: int
    title: str
    agent_role: Optional[str] = None
    message_count: int
    preview: Optional[str] = None
    tags: Optional[list[str]] = None
    created_at: str
    updated_at: str
```

**c) Update `ChatSessionCreate`** — change `agent_id: Optional[int]` → `agent_role: Optional[str]`:

```python
class ChatSessionCreate(BaseModel):
    """Create chat session request."""
    title: str
    agent_role: Optional[str] = None
```

**d) In `ToolResponse`**, remove `assigned_agent_id: Optional[int] = None` field (line 220 original).

- [ ] **Step 8: Verify imports compile**

```bash
python -c "from src.models import ChatSession, ChatMessage, CustomTool, Skill; print('OK')"
```
Expected: `OK`

```bash
python -c "from src.api.models import ChatSessionResponse, ChatRequest; print('OK')"
```
Expected: `OK`

- [ ] **Step 9: Run existing test suite**

```bash
pytest tests/ -v --ignore=tests/test_team_consultation_handler.py -x 2>&1 | tail -20
```
Expected: no import errors on models.

- [ ] **Step 10: Commit**

```bash
git add src/models/ src/config/database.py src/api/models.py
git commit -m "refactor: drop SubAgent model, swap agent_id→agent_role on ChatSession"
```

---

## Task 4: Update chat routing (messages.py + sessions.py + agent_tasks.py)

**Files:**
- Modify: `src/api/routers/chat/messages.py`
- Modify: `src/api/routers/chat/sessions.py`
- Modify: `src/tasks/agent_tasks.py`

- [ ] **Step 1: Update `src/api/routers/chat/messages.py`**

Make these targeted changes:

**a) Remove the `SubAgent` import** (line 16 in original):
```python
# DELETE this line:
from src.models.agent import SubAgent
```

**b) Add registry import** at the top of the imports block:
```python
from src.agent.agent_registry import get_agent_config
```

**c) In the `chat()` endpoint — new session creation block** (around line 88), replace the SubAgent lookup:

```python
# BEFORE (lines 88-99):
agent_id = None
if request.agent_role:
    result = await db.execute(
        select(SubAgent).where(SubAgent.role == request.agent_role)
    )
    agent = result.scalar_one_or_none()
    if agent:
        agent_id = agent.id

session = ChatSession(
    title=request.message[:50] + "..." if len(request.message) > 50 else request.message,
    agent_id=agent_id,
)

# AFTER:
session = ChatSession(
    title=request.message[:50] + "..." if len(request.message) > 50 else request.message,
    agent_role=request.agent_role,
)
```

**d) Replace the agent system prompt resolution block** (around lines 161–168):

```python
# BEFORE:
agent_system_prompt = None
if session and session.agent_id:
    result = await db.execute(
        select(SubAgent).where(SubAgent.id == session.agent_id)
    )
    session_agent = result.scalar_one_or_none()
    if session_agent and session_agent.system_prompt:
        agent_system_prompt = session_agent.system_prompt

# AFTER:
agent_config = get_agent_config(session.agent_role) if session.agent_role else None
agent_system_prompt = agent_config["system_prompt"] if agent_config else None
```

**e) In the `send_chat_message()` endpoint** — replace the SubAgent lookup in new session creation (around lines 376–393):

```python
# BEFORE:
agent_id = None
if request.agent_role:
    result = await db.execute(
        select(SubAgent).where(SubAgent.role == request.agent_role)
    )
    agent = result.scalar_one_or_none()
    if agent:
        agent_id = agent.id

session = ChatSession(
    title=request.message[:50] + "..." if len(request.message) > 50 else request.message,
    agent_id=agent_id,
)

# AFTER:
session = ChatSession(
    title=request.message[:50] + "..." if len(request.message) > 50 else request.message,
    agent_role=request.agent_role,
)
```

**f) In `send_chat_message()` — the Celery task dispatch** (around line 418), change the kwarg:

```python
# BEFORE:
task = process_agent_message.delay(
    ...
    agent_id=session.agent_id,
)

# AFTER:
task = process_agent_message.delay(
    ...
    agent_role=session.agent_role,
)
```

- [ ] **Step 2: Update `src/api/routers/chat/sessions.py`**

Update the `get_chat_sessions()` response to use `agent_role`:

```python
# In the response.append(...) block, change:
# BEFORE:
response.append(ChatSessionResponse(
    id=session.id,
    title=session.title,
    agent_id=session.agent_id,
    agent_name=agent_name,
    ...
))

# AFTER:
response.append(ChatSessionResponse(
    id=session.id,
    title=session.title,
    agent_role=session.agent_role,
    ...
))
```

Also remove the now-unused `agent_name = None` line.

- [ ] **Step 3: Update `src/tasks/agent_tasks.py`**

**a) Remove SubAgent import** (line 10):
```python
# DELETE:
from src.models.agent import SubAgent
```

**b) Add registry import**:
```python
from src.agent.agent_registry import get_agent_config
```

**c) Update `process_agent_message` signature** (line 35–43) — change `agent_id` to `agent_role`:

```python
@celery_app.task(
    bind=True,
    max_retries=3,
    name="src.tasks.agent_tasks.process_agent_message"
)
def process_agent_message(
    self,
    session_id: int,
    message_id: int,
    user_id: str,
    user_message: str,
    patient_id: Optional[int] = None,
    record_id: Optional[int] = None,
    agent_role: Optional[str] = None,   # <-- was agent_id: Optional[int]
):
    return asyncio.run(
        _process_message_async(
            task_id=self.request.id,
            session_id=session_id,
            message_id=message_id,
            user_id=user_id,
            user_message=user_message,
            patient_id=patient_id,
            record_id=record_id,
            agent_role=agent_role,       # <-- was agent_id
        )
    )
```

**d) Update `_process_message_async` signature and body** — change `agent_id: Optional[int]` → `agent_role: Optional[str]`, and replace the SubAgent lookup:

```python
async def _process_message_async(
    task_id: str,
    session_id: int,
    message_id: int,
    user_id: str,
    user_message: str,
    patient_id: Optional[int] = None,
    record_id: Optional[int] = None,
    agent_role: Optional[str] = None,   # <-- was agent_id
):
```

Find the agent prompt resolution block (around lines 178–186) and replace:

```python
# BEFORE:
agent_system_prompt = None
if agent_id:
    agent_result = await db.execute(
        select(SubAgent).where(SubAgent.id == agent_id)
    )
    specialist_agent = agent_result.scalar_one_or_none()
    if specialist_agent and specialist_agent.system_prompt:
        agent_system_prompt = specialist_agent.system_prompt

# AFTER:
agent_config = get_agent_config(agent_role) if agent_role else None
agent_system_prompt = agent_config["system_prompt"] if agent_config else None
```

- [ ] **Step 4: Verify imports compile**

```bash
python -c "from src.api.routers.chat.messages import router; print('OK')"
python -c "from src.tasks.agent_tasks import process_agent_message; print('OK')"
```
Expected: both print `OK`

- [ ] **Step 5: Run test suite**

```bash
pytest tests/ -v -x 2>&1 | tail -20
```
Expected: no failures introduced by this task.

- [ ] **Step 6: Commit**

```bash
git add src/api/routers/chat/messages.py src/api/routers/chat/sessions.py src/tasks/agent_tasks.py
git commit -m "refactor: route chat sessions by agent_role string via registry"
```

---

## Task 5: Replace agents.py CRUD with read-only endpoint + simplify AgentLoader

**Files:**
- Rewrite: `src/api/routers/agents.py`
- Modify: `src/agent/agent_loader.py`

- [ ] **Step 1: Rewrite `src/api/routers/agents.py`**

Replace the entire file:

```python
"""Read-only agent list — serves static registry data."""
from fastapi import APIRouter

from src.agent.agent_registry import list_agents

router = APIRouter(tags=["Agents"])


@router.get("/api/agents")
async def get_agents():
    """List all available agents from the static registry."""
    return [
        {
            "id": idx + 1,        # stable display ID (no DB backing)
            "name": agent["name"],
            "role": agent["role"],
            "description": agent["description"],
            "system_prompt": agent["system_prompt"],
            "enabled": True,
            "color": agent["color"],
            "icon": agent["icon"],
            "is_template": agent.get("is_template", False),
            "tools": agent.get("tools", []),
            "created_at": None,
            "updated_at": None,
        }
        for idx, agent in enumerate(list_agents())
    ]
```

- [ ] **Step 2: Simplify `src/agent/agent_loader.py`**

Replace the entire file:

```python
"""Agent loader — initialises tool registry and loads custom tools on startup.

Sub-agent DB loading has been removed. Agent configs come from agent_registry.
"""
import logging
from typing import Dict, Any

from ..tools.loader import load_custom_tools
from .agent_registry import list_agents

# Import builtin tools to trigger auto-registration
from ..tools import builtin  # noqa: F401
from ..skills import builtin as skill_builtin  # noqa: F401

logger = logging.getLogger(__name__)


class AgentLoader:
    """Initialises tool registry; returns hardcoded agent configs."""

    def __init__(self):
        self.sub_agents: Dict[str, Dict[str, Any]] = {}

    async def load_enabled_agents(self) -> Dict[str, Dict[str, Any]]:
        """Return all agents from the static registry and load custom tools.

        Returns:
            Dict mapping agent role to agent configuration
        """
        # Load custom tools into registry
        await load_custom_tools()

        agents_info = {
            agent["role"]: {
                "id": 0,
                "name": agent["name"],
                "role": agent["role"],
                "description": agent["description"],
                "system_prompt": agent["system_prompt"],
                "color": agent["color"],
                "icon": agent["icon"],
                "tools": agent.get("tools", []),
            }
            for agent in list_agents()
        }

        self.sub_agents = agents_info
        return agents_info
```

- [ ] **Step 3: Verify the endpoint works**

```bash
python -c "
import asyncio
from httpx import AsyncClient, ASGITransport
from src.api.server import app

async def check():
    async with AsyncClient(transport=ASGITransport(app=app), base_url='http://test') as c:
        r = await c.get('/api/agents')
        assert r.status_code == 200
        data = r.json()
        assert len(data) == 6
        roles = {a['role'] for a in data}
        assert 'reception_triage' in roles
        print('GET /api/agents OK, got', len(data), 'agents')

asyncio.run(check())
"
```
Expected: prints `GET /api/agents OK, got 6 agents`

- [ ] **Step 4: Commit**

```bash
git add src/api/routers/agents.py src/agent/agent_loader.py
git commit -m "refactor: replace agents CRUD with read-only registry endpoint"
```

---

## Task 6: Seed script cleanup

**Files:**
- Modify: `scripts/db/seed/seed_full_flow.py`

- [ ] **Step 1: Remove `seed_reception_agent` and its call**

Search the file for `seed_reception_agent` and `async def seed_reception_agent`. Delete:
1. The entire `async def seed_reception_agent(session)` function (and its body — the block that creates/updates the reception agent in DB)
2. The call site that invokes it (something like `await seed_reception_agent(session)`)

Also remove the import of `SubAgent` from this file if it's no longer used after the function is removed. Check: `from ... import SubAgent`.

- [ ] **Step 2: Verify the seed script still imports cleanly**

```bash
python -c "import scripts.db.seed.seed_full_flow; print('OK')"
```
Expected: `OK` (no import errors)

- [ ] **Step 3: Commit**

```bash
git add scripts/db/seed/seed_full_flow.py
git commit -m "refactor: remove seed_reception_agent (prompt now in core_agents.py)"
```

---

## Task 7: Frontend — delete management UI, rewrite agent-card, update sidebar

**Files:**
- Delete (pages): `web/app/(dashboard)/agent/settings/page.tsx`, `web/app/(dashboard)/agent/tools/` directory
- Delete (components): agents-tab, tools-tab, agent-form-dialog, assignments-tab, assignment-canvas, assignment-visualization, assignment-visualization-nodes, tool-assignment-dialog, use-agent-card, canvas/, data.ts, tools/
- Delete (types): `web/types/agent.ts`
- Rewrite: `web/components/agent/agent-card.tsx`
- Modify: `web/components/sidebar.tsx`

- [ ] **Step 1: Delete agent management pages and components**

```bash
# Pages
rm web/app/\(dashboard\)/agent/settings/page.tsx
rm -rf web/app/\(dashboard\)/agent/tools/

# Components — management UI
rm web/components/agent/agents-tab.tsx
rm web/components/agent/tools-tab.tsx
rm web/components/agent/agent-form-dialog.tsx
rm web/components/agent/assignments-tab.tsx
rm web/components/agent/assignment-canvas.tsx
rm web/components/agent/assignment-visualization.tsx
rm web/components/agent/assignment-visualization-nodes.tsx
rm web/components/agent/tool-assignment-dialog.tsx
rm web/components/agent/use-agent-card.ts
rm -rf web/components/agent/canvas/
rm web/components/agent/data.ts
rm -rf web/components/agent/tools/

# Types
rm web/types/agent.ts
```

- [ ] **Step 2: Rewrite `web/components/agent/agent-card.tsx` as display-only**

Replace the entire file:

```tsx
"use client";

import * as Icons from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface AgentConfig {
  name: string;
  role: string;
  description: string;
  color: string;
  icon: string;
  is_template?: boolean;
  tools?: string[];
}

interface AgentCardProps {
  agent: AgentConfig;
}

export function AgentCard({ agent }: AgentCardProps) {
  const IconComponent =
    (Icons as unknown as Record<string, Icons.LucideIcon | undefined>)[agent.icon] ?? Icons.Bot;

  return (
    <Card className="relative overflow-hidden">
      <div
        className="absolute inset-0 opacity-5"
        style={{ background: `linear-gradient(135deg, ${agent.color}22 0%, transparent 100%)` }}
      />
      <div className="relative p-6 space-y-4">
        <div className="flex items-start justify-between">
          <div className="p-3 rounded-xl" style={{ backgroundColor: `${agent.color}15` }}>
            <IconComponent className="h-6 w-6" style={{ color: agent.color }} />
          </div>
          <Badge variant="default">Active</Badge>
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-lg">{agent.name}</h3>
            {agent.is_template && (
              <Badge variant="secondary" className="text-xs">Template</Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground line-clamp-2">{agent.description}</p>
          <Badge variant="outline" className="capitalize" style={{ borderColor: agent.color }}>
            {agent.role.replace(/_/g, " ")}
          </Badge>
        </div>

        {agent.tools && agent.tools.length > 0 && (
          <p className="text-xs text-muted-foreground border-t pt-2">
            {agent.tools.length} tool{agent.tools.length !== 1 ? "s" : ""}
          </p>
        )}
      </div>
    </Card>
  );
}
```

- [ ] **Step 3: Update `web/components/sidebar.tsx` — remove Settings link**

Find the line:
```tsx
{ name: "Settings", href: "/agent/settings", icon: Settings, roles: ["admin"] },
```
and delete it. Also remove the `Settings` icon import from lucide-react if it's no longer used elsewhere in the file. Check the rest of the file first before removing the import.

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd web && npx tsc --noEmit 2>&1 | head -30
```
Expected: no errors referencing deleted files. If there are remaining errors, check which component still imports from `@/types/agent` and fix them.

- [ ] **Step 5: Commit**

```bash
git add web/
git commit -m "feat: remove agent management UI, convert agent-card to display-only"
```

---

## Task 8: Final verification

- [ ] **Step 1: Run full test suite**

```bash
pytest tests/ -v 2>&1 | tail -30
```
Expected: all tests pass (no new failures).

- [ ] **Step 2: Start the dev server and verify no startup errors**

```bash
python -m uvicorn src.api.server:app --port 8001 2>&1 | head -20
```
Expected: `Application startup complete.` with no import errors or DB errors.

- [ ] **Step 3: Smoke-test the agents endpoint**

```bash
curl -s http://localhost:8001/api/agents | python -m json.tool | head -30
```
Expected: JSON array of 6 agents including `reception_triage`.

- [ ] **Step 4: Final commit (if any stragglers)**

```bash
git status
# If any files changed:
git add -p
git commit -m "chore: final cleanup from agent hardcode refactor"
```
