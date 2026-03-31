# Agent Form Tool Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an `ask_user` tool to the reception agent that pauses the agent loop, sends a structured form to the patient's browser via SSE, waits for submission, stores PII in a privacy vault, and returns only opaque IDs to the agent.

**Architecture:** The tool pushes a `form_request` event onto a per-session `asyncio.Queue` side-channel; the SSE `generate()` function races between agent stream events and that queue so it can emit the form event while the tool is suspended on an `asyncio.Event`. A new `POST /api/chat/{session_id}/form-response` endpoint resolves the event with the opaque result. On the frontend the input bar is swapped for a `FormInputBar` when `activeForm` is set.

**Tech Stack:** Python asyncio, FastAPI, SQLAlchemy (sync + async), Alembic, LangGraph, Next.js, React, Tailwind CSS, shadcn/ui

**Spec:** `docs/superpowers/specs/2026-03-31-agent-form-tool-design.md`

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `src/models/intake_submission.py` | IntakeSubmission SQLAlchemy model |
| Modify | `src/models/__init__.py` | Export IntakeSubmission |
| Create | `alembic/versions/XXXX_add_intake_submissions.py` | DB migration |
| Create | `src/forms/__init__.py` | Package marker |
| Create | `src/forms/templates.py` | FormField, FormTemplate, TEMPLATES dict |
| Create | `src/forms/vault.py` | `save_intake()` — persists PII, returns opaque IDs |
| Create | `src/tools/form_request_registry.py` | Singleton: session queues + form events + context var |
| Create | `src/tools/builtin/ask_user_tool.py` | `ask_user(template)` async tool |
| Modify | `src/api/models.py` | Add FormResponseRequest Pydantic model |
| Modify | `src/api/routers/chat/messages.py` | Add form-response endpoint; update `generate()` to race SSE queues |
| Create | `web/components/reception/form-fields.tsx` | Text, date, select, textarea, yes-no field components |
| Create | `web/components/reception/form-input-bar.tsx` | Full form container rendered in place of input bar |
| Modify | `web/app/intake/use-intake-chat.ts` | Add `activeForm` state; handle `form_request` SSE event |
| Modify | `web/app/intake/page.tsx` | Swap input bar for FormInputBar when activeForm is set |

---

## Task 1: IntakeSubmission Model

**Files:**
- Create: `src/models/intake_submission.py`
- Modify: `src/models/__init__.py`
- Test: `tests/test_intake_submission_model.py`

- [ ] **Step 1: Write the failing test**

```python
# tests/test_intake_submission_model.py
import pytest
from src.models.intake_submission import IntakeSubmission


def test_intake_submission_has_required_fields():
    s = IntakeSubmission()
    for field in [
        "id", "patient_id", "first_name", "last_name", "dob", "gender",
        "phone", "email", "address", "chief_complaint", "symptoms",
        "insurance_provider", "policy_id",
        "emergency_contact_name", "emergency_contact_relationship",
        "emergency_contact_phone", "created_at",
    ]:
        assert hasattr(s, field), f"Missing field: {field}"


def test_intake_submission_tablename():
    assert IntakeSubmission.__tablename__ == "intake_submissions"
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pytest tests/test_intake_submission_model.py -v
```
Expected: `ModuleNotFoundError: No module named 'src.models.intake_submission'`

- [ ] **Step 3: Create the model**

```python
# src/models/intake_submission.py
"""Privacy vault for patient intake PII."""
import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, ForeignKey, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base


class IntakeSubmission(Base):
    """Stores raw patient intake PII, keyed by opaque UUID.

    The agent never receives these values — it only receives the
    (patient_id, intake_id) pair returned by vault.save_intake().
    """
    __tablename__ = "intake_submissions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    patient_id: Mapped[int] = mapped_column(ForeignKey("patients.id"), nullable=False)

    # Personal info
    first_name: Mapped[str] = mapped_column(String(100))
    last_name: Mapped[str] = mapped_column(String(100))
    dob: Mapped[str] = mapped_column(String(20))
    gender: Mapped[str] = mapped_column(String(20))

    # Contact
    phone: Mapped[str] = mapped_column(String(30))
    email: Mapped[str] = mapped_column(String(254))
    address: Mapped[str] = mapped_column(Text)

    # Visit
    chief_complaint: Mapped[str] = mapped_column(Text)
    symptoms: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Insurance
    insurance_provider: Mapped[str] = mapped_column(String(200))
    policy_id: Mapped[str] = mapped_column(String(100))

    # Emergency contact
    emergency_contact_name: Mapped[str] = mapped_column(String(200))
    emergency_contact_relationship: Mapped[str] = mapped_column(String(50))
    emergency_contact_phone: Mapped[str] = mapped_column(String(30))

    created_at: Mapped[datetime] = mapped_column(DateTime, default=func.now())

    patient: Mapped["Patient"] = relationship("Patient")
```

- [ ] **Step 4: Export from `src/models/__init__.py`**

Add after the `from .patient import Patient` line:
```python
from .intake_submission import IntakeSubmission
```

Add `"IntakeSubmission"` to the `__all__` list.

- [ ] **Step 5: Run tests to verify they pass**

```bash
pytest tests/test_intake_submission_model.py -v
```
Expected: 2 PASSED

- [ ] **Step 6: Commit**

```bash
git add src/models/intake_submission.py src/models/__init__.py tests/test_intake_submission_model.py
git commit -m "feat: add IntakeSubmission privacy vault model"
```

---

## Task 2: Alembic Migration

**Files:**
- Create: `alembic/versions/XXXX_add_intake_submissions.py` (filename generated by alembic)

- [ ] **Step 1: Generate migration**

```bash
alembic revision --autogenerate -m "add_intake_submissions"
```
Expected: A new file appears in `alembic/versions/` named `<hash>_add_intake_submissions.py`

- [ ] **Step 2: Inspect the generated file**

Open the generated file and verify the `upgrade()` function creates a table named `intake_submissions` with all columns. If the autogenerate missed anything, add it manually. The upgrade should look like:

```python
def upgrade() -> None:
    op.create_table(
        "intake_submissions",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("patient_id", sa.Integer(), sa.ForeignKey("patients.id"), nullable=False),
        sa.Column("first_name", sa.String(100), nullable=False),
        sa.Column("last_name", sa.String(100), nullable=False),
        sa.Column("dob", sa.String(20), nullable=False),
        sa.Column("gender", sa.String(20), nullable=False),
        sa.Column("phone", sa.String(30), nullable=False),
        sa.Column("email", sa.String(254), nullable=False),
        sa.Column("address", sa.Text(), nullable=False),
        sa.Column("chief_complaint", sa.Text(), nullable=False),
        sa.Column("symptoms", sa.Text(), nullable=True),
        sa.Column("insurance_provider", sa.String(200), nullable=False),
        sa.Column("policy_id", sa.String(100), nullable=False),
        sa.Column("emergency_contact_name", sa.String(200), nullable=False),
        sa.Column("emergency_contact_relationship", sa.String(50), nullable=False),
        sa.Column("emergency_contact_phone", sa.String(30), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
    )
```

- [ ] **Step 3: Run migration**

```bash
alembic upgrade head
```
Expected: `Running upgrade ... -> <hash>, add_intake_submissions`

- [ ] **Step 4: Commit**

```bash
git add alembic/versions/
git commit -m "feat: migration — add intake_submissions table"
```

---

## Task 3: Form Templates

**Files:**
- Create: `src/forms/__init__.py`
- Create: `src/forms/templates.py`
- Test: `tests/test_form_templates.py`

- [ ] **Step 1: Write the failing tests**

```python
# tests/test_form_templates.py
import pytest
from src.forms.templates import TEMPLATES, FormTemplate, FormField


def test_patient_intake_template_exists():
    assert "patient_intake" in TEMPLATES


def test_confirm_visit_template_exists():
    assert "confirm_visit" in TEMPLATES


def test_patient_intake_has_required_fields():
    template = TEMPLATES["patient_intake"]
    field_names = [f.name for f in template.fields]
    for name in [
        "first_name", "last_name", "dob", "gender",
        "phone", "email", "address", "chief_complaint",
        "insurance_provider", "policy_id",
        "emergency_contact_name", "emergency_contact_relationship",
        "emergency_contact_phone",
    ]:
        assert name in field_names, f"Missing field: {name}"


def test_symptoms_is_optional():
    template = TEMPLATES["patient_intake"]
    symptoms = next(f for f in template.fields if f.name == "symptoms")
    assert symptoms.required is False


def test_confirm_visit_is_yes_no():
    template = TEMPLATES["confirm_visit"]
    assert template.form_type == "yes_no"


def test_to_schema_returns_serialisable_dict():
    import json
    schema = TEMPLATES["patient_intake"].to_schema()
    # Must be JSON-serialisable
    json.dumps(schema)
    assert schema["form_type"] == "multi_field"
    assert len(schema["fields"]) > 0
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pytest tests/test_form_templates.py -v
```
Expected: `ModuleNotFoundError: No module named 'src.forms'`

- [ ] **Step 3: Create package and templates**

```python
# src/forms/__init__.py
```

```python
# src/forms/templates.py
"""Hardcoded form templates for the reception agent's ask_user tool."""
from dataclasses import dataclass, field
from typing import Literal


@dataclass
class FormField:
    name: str
    label: str
    field_type: Literal["text", "date", "select", "textarea"]
    required: bool = True
    options: list[str] = field(default_factory=list)
    placeholder: str = ""

    def to_dict(self) -> dict:
        d = {
            "name": self.name,
            "label": self.label,
            "field_type": self.field_type,
            "required": self.required,
        }
        if self.options:
            d["options"] = self.options
        if self.placeholder:
            d["placeholder"] = self.placeholder
        return d


@dataclass
class FormTemplate:
    title: str
    form_type: Literal["multi_field", "yes_no"]
    fields: list[FormField] = field(default_factory=list)
    message: str = ""

    def to_schema(self) -> dict:
        return {
            "title": self.title,
            "form_type": self.form_type,
            "message": self.message,
            "fields": [f.to_dict() for f in self.fields],
        }


TEMPLATES: dict[str, FormTemplate] = {
    "patient_intake": FormTemplate(
        title="Patient Check-In",
        form_type="multi_field",
        fields=[
            # Personal info
            FormField("first_name", "First Name", "text", placeholder="Jane"),
            FormField("last_name", "Last Name", "text", placeholder="Doe"),
            FormField("dob", "Date of Birth", "date"),
            FormField("gender", "Gender", "select", options=["male", "female", "other"]),
            # Contact
            FormField("phone", "Phone Number", "text", placeholder="+1 555 000 0000"),
            FormField("email", "Email Address", "text", placeholder="jane@example.com"),
            FormField("address", "Home Address", "textarea", placeholder="123 Main St, City, State"),
            # Visit
            FormField("chief_complaint", "Reason for Visit", "text", placeholder="e.g. chest pain, follow-up"),
            FormField("symptoms", "Symptoms (optional)", "textarea", required=False, placeholder="Describe any symptoms..."),
            # Insurance
            FormField("insurance_provider", "Insurance Provider", "text", placeholder="e.g. Blue Cross"),
            FormField("policy_id", "Policy / Member ID", "text"),
            # Emergency contact
            FormField("emergency_contact_name", "Emergency Contact Name", "text"),
            FormField(
                "emergency_contact_relationship",
                "Relationship",
                "select",
                options=["spouse", "parent", "sibling", "friend", "other"],
            ),
            FormField("emergency_contact_phone", "Emergency Contact Phone", "text"),
        ],
    ),
    "confirm_visit": FormTemplate(
        title="Confirm Check-In",
        form_type="yes_no",
        message="Are you ready to proceed with your visit today?",
    ),
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pytest tests/test_form_templates.py -v
```
Expected: 6 PASSED

- [ ] **Step 5: Commit**

```bash
git add src/forms/ tests/test_form_templates.py
git commit -m "feat: add form templates for patient_intake and confirm_visit"
```

---

## Task 4: Privacy Vault

**Files:**
- Create: `src/forms/vault.py`
- Test: `tests/test_forms_vault.py`

- [ ] **Step 1: Write the failing tests**

```python
# tests/test_forms_vault.py
import pytest
from unittest.mock import MagicMock, AsyncMock, patch
from src.forms.vault import save_intake


@pytest.mark.asyncio
async def test_save_intake_returns_patient_id_and_intake_id():
    """save_intake must return (int, str) — no PII."""
    answers = {
        "first_name": "Jane", "last_name": "Doe", "dob": "1990-05-15",
        "gender": "female", "phone": "555-0100", "email": "jane@test.com",
        "address": "1 Main St", "chief_complaint": "headache", "symptoms": "",
        "insurance_provider": "BlueCross", "policy_id": "BC123",
        "emergency_contact_name": "John Doe",
        "emergency_contact_relationship": "spouse",
        "emergency_contact_phone": "555-0101",
    }

    mock_patient = MagicMock()
    mock_patient.id = 42

    mock_submission = MagicMock()
    mock_submission.id = "vault-abc"

    mock_db = AsyncMock()
    # First execute: patient lookup returns nothing (new patient)
    mock_result_patient = MagicMock()
    mock_result_patient.scalar_one_or_none.return_value = None
    # Second execute: won't be called (we add + refresh instead)
    mock_db.execute.return_value = mock_result_patient
    mock_db.refresh.side_effect = [
        None,  # patient refresh
        None,  # submission refresh
    ]

    # Simulate refresh setting .id
    async def fake_refresh(obj):
        if isinstance(obj, __import__("src.models.patient", fromlist=["Patient"]).Patient):
            obj.id = 42
        else:
            obj.id = "vault-abc"

    mock_db.refresh.side_effect = fake_refresh

    with patch("src.forms.vault.AsyncSessionLocal") as mock_session_cls:
        mock_ctx = AsyncMock()
        mock_ctx.__aenter__ = AsyncMock(return_value=mock_db)
        mock_ctx.__aexit__ = AsyncMock(return_value=False)
        mock_session_cls.return_value = mock_ctx

        patient_id, intake_id = await save_intake(answers)

    assert isinstance(patient_id, int)
    assert isinstance(intake_id, str)


@pytest.mark.asyncio
async def test_save_intake_reuses_existing_patient():
    """When patient lookup finds a match, it reuses that patient's id."""
    answers = {
        "first_name": "Jane", "last_name": "Doe", "dob": "1990-05-15",
        "gender": "female", "phone": "555-0100", "email": "jane@test.com",
        "address": "1 Main St", "chief_complaint": "headache", "symptoms": "",
        "insurance_provider": "BlueCross", "policy_id": "BC123",
        "emergency_contact_name": "John Doe",
        "emergency_contact_relationship": "spouse",
        "emergency_contact_phone": "555-0101",
    }

    mock_existing_patient = MagicMock()
    mock_existing_patient.id = 7

    mock_db = AsyncMock()
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = mock_existing_patient
    mock_db.execute.return_value = mock_result

    async def fake_refresh(obj):
        obj.id = "vault-xyz"

    mock_db.refresh.side_effect = fake_refresh

    with patch("src.forms.vault.AsyncSessionLocal") as mock_session_cls:
        mock_ctx = AsyncMock()
        mock_ctx.__aenter__ = AsyncMock(return_value=mock_db)
        mock_ctx.__aexit__ = AsyncMock(return_value=False)
        mock_session_cls.return_value = mock_ctx

        patient_id, intake_id = await save_intake(answers)

    assert patient_id == 7
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pytest tests/test_forms_vault.py -v
```
Expected: `ModuleNotFoundError: No module named 'src.forms.vault'`

- [ ] **Step 3: Implement vault**

```python
# src/forms/vault.py
"""Privacy vault — saves intake PII, returns opaque IDs to callers."""
import uuid
import logging
from sqlalchemy import select

from src.models.base import AsyncSessionLocal
from src.models.patient import Patient
from src.models.intake_submission import IntakeSubmission

logger = logging.getLogger(__name__)


async def save_intake(answers: dict[str, str]) -> tuple[int, str]:
    """Persist patient intake answers and return (patient_id, intake_id).

    Looks up an existing Patient by (first_name, last_name, dob).
    Creates a new Patient if none is found.
    Always creates a new IntakeSubmission row.

    Args:
        answers: Dict of field_name → value from the intake form.

    Returns:
        (patient_id, intake_id) — opaque identifiers, no PII.
    """
    full_name = f"{answers['first_name'].strip()} {answers['last_name'].strip()}"
    dob = answers["dob"].strip()
    gender = answers["gender"].strip()

    async with AsyncSessionLocal() as db:
        # Look up existing patient by name + dob
        result = await db.execute(
            select(Patient).where(
                Patient.name == full_name,
                Patient.dob == dob,
            )
        )
        patient = result.scalar_one_or_none()

        if patient is None:
            patient = Patient(name=full_name, dob=dob, gender=gender)
            db.add(patient)
            await db.flush()  # get patient.id before creating submission

        submission = IntakeSubmission(
            id=str(uuid.uuid4()),
            patient_id=patient.id,
            first_name=answers["first_name"].strip(),
            last_name=answers["last_name"].strip(),
            dob=dob,
            gender=gender,
            phone=answers.get("phone", "").strip(),
            email=answers.get("email", "").strip(),
            address=answers.get("address", "").strip(),
            chief_complaint=answers.get("chief_complaint", "").strip(),
            symptoms=answers.get("symptoms", "").strip() or None,
            insurance_provider=answers.get("insurance_provider", "").strip(),
            policy_id=answers.get("policy_id", "").strip(),
            emergency_contact_name=answers.get("emergency_contact_name", "").strip(),
            emergency_contact_relationship=answers.get("emergency_contact_relationship", "").strip(),
            emergency_contact_phone=answers.get("emergency_contact_phone", "").strip(),
        )
        db.add(submission)
        await db.commit()
        await db.refresh(submission)

        logger.info(
            "Intake saved: patient_id=%s intake_id=%s",
            patient.id,
            submission.id,
        )
        return patient.id, submission.id
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pytest tests/test_forms_vault.py -v
```
Expected: 2 PASSED

- [ ] **Step 5: Commit**

```bash
git add src/forms/vault.py tests/test_forms_vault.py
git commit -m "feat: add privacy vault for intake PII"
```

---

## Task 5: FormRequestRegistry

**Files:**
- Create: `src/tools/form_request_registry.py`
- Test: `tests/test_form_request_registry.py`

- [ ] **Step 1: Write the failing tests**

```python
# tests/test_form_request_registry.py
import asyncio
import pytest
from src.tools.form_request_registry import FormRequestRegistry, current_session_id_var


@pytest.fixture(autouse=True)
def reset_registry():
    """Each test gets a clean registry."""
    reg = FormRequestRegistry()
    reg.reset()
    yield
    reg.reset()


def test_register_and_get_session_queue():
    reg = FormRequestRegistry()
    q = asyncio.Queue()
    reg.register_session_queue(1, q)
    assert reg.get_session_queue(1) is q


def test_unregister_session_queue():
    reg = FormRequestRegistry()
    q = asyncio.Queue()
    reg.register_session_queue(1, q)
    reg.unregister_session_queue(1)
    assert reg.get_session_queue(1) is None


@pytest.mark.asyncio
async def test_register_form_and_resolve():
    reg = FormRequestRegistry()
    event = asyncio.Event()
    reg.register_form("form-1", event, "confirm_visit")

    reg.resolve_form("form-1", "confirmed")

    assert event.is_set()
    assert reg.get_form_result("form-1") == "confirmed"


def test_get_form_template():
    reg = FormRequestRegistry()
    event = asyncio.Event()
    reg.register_form("form-2", event, "patient_intake")
    assert reg.get_form_template("form-2") == "patient_intake"


def test_cleanup_form_removes_entry():
    reg = FormRequestRegistry()
    event = asyncio.Event()
    reg.register_form("form-3", event, "confirm_visit")
    reg.cleanup_form("form-3")
    assert reg.get_form_result("form-3") is None
    assert reg.get_form_template("form-3") is None


def test_get_form_entry_returns_none_for_unknown():
    reg = FormRequestRegistry()
    assert reg.get_form_result("no-such-id") is None


def test_context_var_default_is_none():
    assert current_session_id_var.get() is None
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pytest tests/test_form_request_registry.py -v
```
Expected: `ModuleNotFoundError`

- [ ] **Step 3: Implement registry**

```python
# src/tools/form_request_registry.py
"""In-memory registry that coordinates form requests between tools and SSE streams.

Each active chat session gets a side-channel asyncio.Queue that the SSE
generate() function reads from alongside the agent event stream.

Each pending form gets an asyncio.Event that the ask_user tool awaits.
The POST /form-response endpoint resolves it by calling resolve_form().
"""
import asyncio
import contextvars
import logging
from typing import Optional

logger = logging.getLogger(__name__)

# Allows ask_user tool to find its session's side-channel queue
# without needing an explicit parameter.
current_session_id_var: contextvars.ContextVar[Optional[int]] = contextvars.ContextVar(
    "current_session_id", default=None
)


class FormRequestRegistry:
    """Singleton coordinating form events between tools and SSE streams."""

    _instance: Optional["FormRequestRegistry"] = None

    # session_id -> asyncio.Queue (SSE side-channel)
    _session_queues: dict[int, asyncio.Queue]

    # form_id -> asyncio.Event
    _form_events: dict[str, asyncio.Event]

    # form_id -> result string
    _form_results: dict[str, str]

    # form_id -> template name
    _form_templates: dict[str, str]

    def __new__(cls) -> "FormRequestRegistry":
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._session_queues = {}
            cls._instance._form_events = {}
            cls._instance._form_results = {}
            cls._instance._form_templates = {}
        return cls._instance

    # --- session queue API ---

    def register_session_queue(self, session_id: int, queue: asyncio.Queue) -> None:
        self._session_queues[session_id] = queue

    def unregister_session_queue(self, session_id: int) -> None:
        self._session_queues.pop(session_id, None)

    def get_session_queue(self, session_id: Optional[int]) -> Optional[asyncio.Queue]:
        if session_id is None:
            return None
        return self._session_queues.get(session_id)

    # --- form event API ---

    def register_form(self, form_id: str, event: asyncio.Event, template: str) -> None:
        self._form_events[form_id] = event
        self._form_templates[form_id] = template

    def resolve_form(self, form_id: str, result: str) -> None:
        """Store result and fire the event so the waiting tool can return."""
        self._form_results[form_id] = result
        event = self._form_events.get(form_id)
        if event:
            event.set()
        else:
            logger.warning("resolve_form called for unknown form_id: %s", form_id)

    def get_form_result(self, form_id: str) -> Optional[str]:
        return self._form_results.get(form_id)

    def get_form_template(self, form_id: str) -> Optional[str]:
        return self._form_templates.get(form_id)

    def cleanup_form(self, form_id: str) -> None:
        self._form_events.pop(form_id, None)
        self._form_results.pop(form_id, None)
        self._form_templates.pop(form_id, None)

    def reset(self) -> None:
        """Clear all state. For tests only."""
        self._session_queues.clear()
        self._form_events.clear()
        self._form_results.clear()
        self._form_templates.clear()


# Module-level singleton
form_registry = FormRequestRegistry()
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pytest tests/test_form_request_registry.py -v
```
Expected: 8 PASSED (7 existing + 1 new test for None session_id)

- [ ] **Step 5: Commit**

```bash
git add src/tools/form_request_registry.py tests/test_form_request_registry.py
git commit -m "feat: add FormRequestRegistry for SSE form side-channel"
```

---

## Task 6: ask_user Tool

**Files:**
- Create: `src/tools/builtin/ask_user_tool.py`
- Test: `tests/test_ask_user_tool.py`

- [ ] **Step 1: Write the failing tests**

```python
# tests/test_ask_user_tool.py
import asyncio
import pytest
from unittest.mock import patch, MagicMock
from src.tools.form_request_registry import FormRequestRegistry, current_session_id_var


@pytest.fixture(autouse=True)
def reset_registry():
    reg = FormRequestRegistry()
    reg.reset()
    yield
    reg.reset()


@pytest.mark.asyncio
async def test_ask_user_returns_confirm_result():
    """ask_user blocks until resolved, then returns the stored result."""
    from src.tools.builtin.ask_user_tool import ask_user

    # Set up: session queue + context var
    session_id = 99
    side_queue = asyncio.Queue()
    reg = FormRequestRegistry()
    reg.register_session_queue(session_id, side_queue)
    current_session_id_var.set(session_id)

    # Simulate form submission after a short delay
    async def resolve_after_delay():
        await asyncio.sleep(0.05)
        item = await side_queue.get()  # consume the form_request event
        form_id = item["payload"]["id"]
        reg.resolve_form(form_id, "confirmed")

    asyncio.create_task(resolve_after_delay())

    result = await ask_user("confirm_visit")
    assert result == "confirmed"


@pytest.mark.asyncio
async def test_ask_user_puts_form_request_on_queue():
    """ask_user must push a form_request event to the session queue."""
    from src.tools.builtin.ask_user_tool import ask_user

    session_id = 100
    side_queue = asyncio.Queue()
    reg = FormRequestRegistry()
    reg.register_session_queue(session_id, side_queue)
    current_session_id_var.set(session_id)

    async def resolve_immediately():
        await asyncio.sleep(0.02)
        item = await side_queue.get()
        assert item["type"] == "form_request"
        assert item["payload"]["template"] == "patient_intake"
        form_id = item["payload"]["id"]
        reg.resolve_form(form_id, "intake_completed. patient_id=1, intake_id=v-abc")

    asyncio.create_task(resolve_immediately())
    result = await ask_user("patient_intake")
    assert result.startswith("intake_completed")


@pytest.mark.asyncio
async def test_ask_user_unknown_template_returns_error():
    from src.tools.builtin.ask_user_tool import ask_user

    current_session_id_var.set(None)
    result = await ask_user("nonexistent_template")
    assert result.startswith("Error:")
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pytest tests/test_ask_user_tool.py -v
```
Expected: `ModuleNotFoundError`

- [ ] **Step 3: Implement the tool**

```python
# src/tools/builtin/ask_user_tool.py
"""ask_user — lets the reception agent collect structured input from the patient.

Registered at import time. Scope: reception (assigned manually in DB to
the reception_triage sub-agent only).

Privacy contract: this tool NEVER returns raw PII. It returns status strings
and opaque IDs only. The vault handles PII storage.
"""
import asyncio
import logging
import uuid

from src.forms.templates import TEMPLATES
from src.tools.form_request_registry import form_registry, current_session_id_var
from src.tools.registry import ToolRegistry

logger = logging.getLogger(__name__)

FORM_TIMEOUT_SECONDS = 300.0


async def ask_user(template: str) -> str:
    """Request structured input from the patient via an interactive form.

    Pauses the agent until the patient submits the form. Returns a status
    string with opaque IDs — never raw PII.

    Use this tool when you need patient information or a confirmation.
    Do not attempt to read or interpret the personal data returned.

    Args:
        template: Which form to show.
            "patient_intake" — full check-in form (name, DOB, insurance, etc.)
            "confirm_visit"  — yes/no confirmation before creating a visit

    Returns:
        For "patient_intake":
            "intake_completed. patient_id=<N>, intake_id=<UUID>"
        For "confirm_visit":
            "confirmed" or "declined"
        On timeout: "form_timeout"
        On error:   "Error: <message>"
    """
    if template not in TEMPLATES:
        return f"Error: unknown template '{template}'. Valid: {list(TEMPLATES)}"

    form_id = str(uuid.uuid4())
    session_id = current_session_id_var.get()

    # Register form event
    event = asyncio.Event()
    form_registry.register_form(form_id, event, template)

    # Push form_request to SSE side-channel
    queue = form_registry.get_session_queue(session_id)
    if queue is None:
        logger.warning("ask_user called with no session queue (session_id=%s)", session_id)
    else:
        await queue.put({
            "type": "form_request",
            "payload": {
                "id": form_id,
                "template": template,
                "schema": TEMPLATES[template].to_schema(),
            },
        })

    # Wait for patient to submit the form
    try:
        await asyncio.wait_for(event.wait(), timeout=FORM_TIMEOUT_SECONDS)
    except asyncio.TimeoutError:
        logger.info("Form timed out: form_id=%s session_id=%s", form_id, session_id)
        form_registry.cleanup_form(form_id)
        return "form_timeout"

    result = form_registry.get_form_result(form_id)
    form_registry.cleanup_form(form_id)
    logger.info("Form completed: form_id=%s result=%s", form_id, result)
    return result or "form_error"


_registry = ToolRegistry()
_registry.register(
    ask_user,
    scope="global",
    symbol="ask_user",
    allow_overwrite=True,
)
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pytest tests/test_ask_user_tool.py -v
```
Expected: 3 PASSED

- [ ] **Step 5: Commit**

```bash
git add src/tools/builtin/ask_user_tool.py tests/test_ask_user_tool.py
git commit -m "feat: add ask_user tool for reception agent form requests"
```

---

## Task 7: API — Form-Response Endpoint + Updated generate()

**Files:**
- Modify: `src/api/models.py`
- Modify: `src/api/routers/chat/messages.py`
- Test: `tests/test_form_response_endpoint.py`

- [ ] **Step 1: Add Pydantic model to `src/api/models.py`**

Open `src/api/models.py` and add at the end:

```python
class FormResponseRequest(BaseModel):
    """Body for POST /api/chat/{session_id}/form-response."""
    form_id: str
    answers: dict[str, str]
```

- [ ] **Step 2: Write the failing endpoint test**

```python
# tests/test_form_response_endpoint.py
import asyncio
import pytest
from unittest.mock import patch, AsyncMock
from httpx import AsyncClient, ASGITransport
from src.api.server import app
from src.tools.form_request_registry import FormRequestRegistry


@pytest.fixture(autouse=True)
def reset_registry():
    reg = FormRequestRegistry()
    reg.reset()
    yield
    reg.reset()


@pytest.mark.asyncio
async def test_form_response_404_for_unknown_form():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.post(
            "/api/chat/1/form-response",
            json={"form_id": "no-such-form", "answers": {}},
        )
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_form_response_resolves_confirm_visit():
    reg = FormRequestRegistry()
    event = asyncio.Event()
    reg.register_form("test-form-1", event, "confirm_visit")

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.post(
            "/api/chat/1/form-response",
            json={"form_id": "test-form-1", "answers": {"confirmed": "true"}},
        )
    assert resp.status_code == 200
    assert event.is_set()
    assert reg.get_form_result("test-form-1") == "confirmed"


@pytest.mark.asyncio
async def test_form_response_resolves_declined():
    reg = FormRequestRegistry()
    event = asyncio.Event()
    reg.register_form("test-form-2", event, "confirm_visit")

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.post(
            "/api/chat/1/form-response",
            json={"form_id": "test-form-2", "answers": {"confirmed": "false"}},
        )
    assert resp.status_code == 200
    assert reg.get_form_result("test-form-2") == "declined"
```

- [ ] **Step 3: Run tests to verify they fail**

```bash
pytest tests/test_form_response_endpoint.py -v
```
Expected: 404 on all (route not registered yet)

- [ ] **Step 4: Add form-response route to `messages.py`**

At the top of `src/api/routers/chat/messages.py`, add to the existing imports:

```python
import asyncio
import contextvars
from src.tools.form_request_registry import form_registry, current_session_id_var
from src.forms.vault import save_intake
from ...models import FormResponseRequest
```

Then add this route **before** the existing `@router.post("/api/chat")` handler:

```python
@router.post("/api/chat/{session_id}/form-response")
async def submit_form_response(session_id: int, body: FormResponseRequest):
    """Receive patient form submission and unblock the waiting ask_user tool.

    Validates the form_id, processes PII via the vault (for patient_intake),
    stores the opaque result, then fires the asyncio.Event so the tool returns.
    """
    template = form_registry.get_form_template(body.form_id)
    if template is None:
        raise HTTPException(status_code=404, detail="Form not found or expired")

    if template == "patient_intake":
        try:
            patient_id, intake_id = await save_intake(body.answers)
            result = f"intake_completed. patient_id={patient_id}, intake_id={intake_id}"
        except Exception as e:
            logger.error("Vault save failed: %s", e, exc_info=True)
            raise HTTPException(status_code=500, detail="Failed to save intake data")
    elif template == "confirm_visit":
        confirmed = body.answers.get("confirmed", "false").lower()
        result = "confirmed" if confirmed in ("true", "yes", "1") else "declined"
    else:
        raise HTTPException(status_code=400, detail=f"Unknown template: {template}")

    form_registry.resolve_form(body.form_id, result)
    return {"status": "ok"}
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
pytest tests/test_form_response_endpoint.py -v
```
Expected: 3 PASSED

- [ ] **Step 6: Update `generate()` to race agent and form queues**

Find the `if request.stream:` block in `src/api/routers/chat/messages.py`. Replace the entire `async def generate():` function (but keep everything before and after it) with:

```python
        if request.stream:
            async def generate():
                full_response = ""
                all_patient_references = []
                total_usage = {"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0}
                tool_calls_buffer = []
                logs_buffer = []

                # --- form side-channel setup ---
                form_event_queue: asyncio.Queue = asyncio.Queue()
                form_registry.register_session_queue(session.id, form_event_queue)
                current_session_id_var.set(session.id)
                # --------------------------------

                try:
                    # Drain the agent stream into a queue so we can race it
                    # against the form side-channel.
                    agent_event_queue: asyncio.Queue = asyncio.Queue()

                    async def drain_agent():
                        stream = await user_agent.process_message(
                            user_message=context_message.strip(),
                            stream=True,
                            chat_history=chat_history,
                            patient_id=patient.id if patient else None,
                            patient_name=patient.name if patient else None,
                            system_prompt_override=agent_system_prompt,
                        )
                        async for evt in stream:
                            await agent_event_queue.put(evt)
                        await agent_event_queue.put(None)  # sentinel

                    agent_task = asyncio.create_task(drain_agent())

                    while True:
                        get_agent = asyncio.create_task(agent_event_queue.get())
                        get_form = asyncio.create_task(form_event_queue.get())

                        done_set, pending_set = await asyncio.wait(
                            {get_agent, get_form},
                            return_when=asyncio.FIRST_COMPLETED,
                        )

                        for t in pending_set:
                            t.cancel()
                            try:
                                await t
                            except asyncio.CancelledError:
                                pass

                        event = done_set.pop().result()

                        if event is None:
                            break  # agent stream finished

                        # Form side-channel event — emit and continue
                        if isinstance(event, dict) and event.get("type") == "form_request":
                            yield f"data: {json.dumps({'form_request': event['payload']})}\n\n"
                            continue

                        # Regular agent events (unchanged logic)
                        if isinstance(event, dict):
                            if event["type"] == "content":
                                chunk_content = event["content"]
                                full_response += chunk_content
                                yield f"data: {json.dumps({'chunk': chunk_content})}\n\n"
                            elif event["type"] == "tool_call":
                                tool_calls_buffer.append(event)
                                yield f"data: {json.dumps({'tool_call': event})}\n\n"
                            elif event["type"] == "tool_result":
                                for tc in tool_calls_buffer:
                                    if tc.get("id") == event.get("id"):
                                        tc["result"] = event.get("result")
                                logs_buffer.append({
                                    "timestamp": datetime.now(timezone.utc).isoformat(),
                                    "type": "tool_result",
                                    "content": event,
                                })
                                yield f"data: {json.dumps({'tool_result': event})}\n\n"
                            elif event["type"] == "reasoning":
                                yield f"data: {json.dumps({'reasoning': event['content']})}\n\n"
                            elif event["type"] == "log":
                                logs_buffer.append({
                                    "timestamp": datetime.now(timezone.utc).isoformat(),
                                    "type": "log",
                                    "content": event["content"],
                                })
                                yield f"data: {json.dumps({'log': event['content']})}\n\n"
                            elif event["type"] == "patient_references":
                                all_patient_references = event["patient_references"]
                                yield f"data: {json.dumps({'patient_references': event['patient_references']})}\n\n"
                            elif event["type"] == "usage":
                                usage = event["usage"]
                                total_usage["prompt_tokens"] += usage.get("prompt_tokens", 0)
                                total_usage["completion_tokens"] += usage.get("completion_tokens", 0)
                                total_usage["total_tokens"] += usage.get("total_tokens", 0)
                                yield f"data: {json.dumps({'usage': event['usage']})}\n\n"
                        else:
                            full_response = event
                            yield f"data: {json.dumps({'chunk': event})}\n\n"

                    if full_response or tool_calls_buffer:
                        async with AsyncSessionLocal() as local_db:
                            assistant_msg = ChatMessage(
                                session_id=session.id,
                                role="assistant",
                                content=full_response,
                                tool_calls=json.dumps(tool_calls_buffer) if tool_calls_buffer else None,
                                logs=json.dumps(logs_buffer) if logs_buffer else None,
                                patient_references=json.dumps(all_patient_references) if all_patient_references else None,
                                token_usage=json.dumps(total_usage) if total_usage["total_tokens"] > 0 else None,
                            )
                            local_db.add(assistant_msg)
                            await local_db.commit()

                    yield f"data: {json.dumps({'session_id': session.id})}\n\n"
                    yield f"data: {json.dumps({'done': True})}\n\n"

                except Exception as e:
                    async with AsyncSessionLocal() as local_db:
                        assistant_msg = ChatMessage(
                            session_id=session.id,
                            role="assistant",
                            content=full_response,
                            status="error",
                            error_message=str(e),
                            patient_references=json.dumps(all_patient_references) if all_patient_references else None,
                            token_usage=json.dumps(total_usage) if total_usage["total_tokens"] > 0 else None,
                        )
                        local_db.add(assistant_msg)
                        await local_db.commit()
                    yield f"data: {json.dumps({'error': str(e)})}\n\n"

                finally:
                    form_registry.unregister_session_queue(session.id)

            return StreamingResponse(generate(), media_type="text/event-stream")
```

- [ ] **Step 7: Run all backend tests**

```bash
pytest tests/ -v --ignore=tests/integration -k "not slow"
```
Expected: All previously-passing tests still PASS; no regressions.

- [ ] **Step 8: Commit**

```bash
git add src/api/models.py src/api/routers/chat/messages.py tests/test_form_response_endpoint.py
git commit -m "feat: add form-response endpoint and SSE racing in generate()"
```

---

## Task 8: Frontend — Form Field Components

**Files:**
- Create: `web/components/reception/form-fields.tsx`

*(No automated tests — visual UI component. Verify manually in Task 10.)*

- [ ] **Step 1: Create the component**

```tsx
// web/components/reception/form-fields.tsx
"use client";

import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export interface FormFieldDef {
  name: string;
  label: string;
  field_type: "text" | "date" | "select" | "textarea";
  required: boolean;
  options?: string[];
  placeholder?: string;
}

interface FieldProps {
  field: FormFieldDef;
  value: string;
  onChange: (name: string, value: string) => void;
  error?: string;
}

export function FormFieldInput({ field, value, onChange, error }: FieldProps) {
  const id = `form-field-${field.name}`;

  return (
    <div className="space-y-1">
      <Label htmlFor={id} className="text-xs font-medium text-foreground/80">
        {field.label}
        {field.required && <span className="text-red-400 ml-0.5">*</span>}
      </Label>

      {field.field_type === "select" ? (
        <Select value={value} onValueChange={(v) => onChange(field.name, v)}>
          <SelectTrigger id={id} className={cn("h-8 text-sm", error && "border-red-400")}>
            <SelectValue placeholder={`Select ${field.label.toLowerCase()}`} />
          </SelectTrigger>
          <SelectContent>
            {field.options?.map((opt) => (
              <SelectItem key={opt} value={opt}>
                {opt.charAt(0).toUpperCase() + opt.slice(1)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : field.field_type === "textarea" ? (
        <Textarea
          id={id}
          value={value}
          onChange={(e) => onChange(field.name, e.target.value)}
          placeholder={field.placeholder}
          rows={2}
          className={cn("text-sm resize-none", error && "border-red-400")}
        />
      ) : (
        <Input
          id={id}
          type={field.field_type === "date" ? "date" : "text"}
          value={value}
          onChange={(e) => onChange(field.name, e.target.value)}
          placeholder={field.placeholder}
          className={cn("h-8 text-sm", error && "border-red-400")}
        />
      )}

      {error && <p className="text-[10px] text-red-400">{error}</p>}
    </div>
  );
}
```

- [ ] **Step 2: Verify shadcn Textarea is available**

```bash
ls web/components/ui/textarea.tsx 2>/dev/null && echo "EXISTS" || echo "MISSING"
```

If MISSING, add it:
```bash
cd web && npx shadcn@latest add textarea
```

- [ ] **Step 3: Commit**

```bash
git add web/components/reception/form-fields.tsx
git commit -m "feat: add FormFieldInput component for reception forms"
```

---

## Task 9: Frontend — FormInputBar Component

**Files:**
- Create: `web/components/reception/form-input-bar.tsx`

- [ ] **Step 1: Create the component**

```tsx
// web/components/reception/form-input-bar.tsx
"use client";

import { useState } from "react";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FormFieldInput, type FormFieldDef } from "./form-fields";

export interface ActiveForm {
  id: string;
  template: string;
  schema: {
    title: string;
    form_type: "multi_field" | "yes_no";
    message: string;
    fields: FormFieldDef[];
  };
}

interface FormInputBarProps {
  activeForm: ActiveForm;
  sessionId: number;
  onSubmitted: () => void;
}

const SECTION_LABELS: Record<string, string> = {
  first_name: "Personal Info",
  phone: "Contact",
  chief_complaint: "Visit",
  insurance_provider: "Insurance",
  emergency_contact_name: "Emergency Contact",
};

function getSectionLabel(fieldName: string): string | undefined {
  return SECTION_LABELS[fieldName];
}

export function FormInputBar({ activeForm, sessionId, onSubmitted }: FormInputBarProps) {
  const { schema } = activeForm;

  const [values, setValues] = useState<Record<string, string>>(
    Object.fromEntries(schema.fields.map((f) => [f.name, ""]))
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const handleChange = (name: string, value: string) => {
    setValues((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: "" }));
    }
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    for (const field of schema.fields) {
      if (field.required && !values[field.name]?.trim()) {
        newErrors[field.name] = "Required";
      }
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const submit = async (confirmed?: boolean) => {
    if (schema.form_type === "multi_field" && !validate()) return;

    setSubmitting(true);
    const answers =
      schema.form_type === "yes_no"
        ? { confirmed: String(confirmed ?? false) }
        : values;

    try {
      const resp = await fetch(`/api/chat/${sessionId}/form-response`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ form_id: activeForm.id, answers }),
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      onSubmitted();
    } catch (err) {
      console.error("Form submission failed:", err);
    } finally {
      setSubmitting(false);
    }
  };

  if (schema.form_type === "yes_no") {
    return (
      <div className="border-t border-border/50 bg-card/40 backdrop-blur-sm px-4 py-4">
        <p className="text-sm text-foreground/80 mb-3">{schema.message}</p>
        <div className="flex gap-2">
          <Button
            onClick={() => submit(true)}
            disabled={submitting}
            className="flex-1 bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-600 hover:to-teal-600 text-white h-9"
          >
            {submitting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <><CheckCircle2 className="w-4 h-4 mr-1.5" />Confirm</>
            )}
          </Button>
          <Button
            onClick={() => submit(false)}
            disabled={submitting}
            variant="outline"
            className="flex-1 h-9 border-border/50"
          >
            <XCircle className="w-4 h-4 mr-1.5" />Cancel
          </Button>
        </div>
      </div>
    );
  }

  // multi_field form
  return (
    <div className="border-t border-border/50 bg-card/40 backdrop-blur-sm">
      <div className="px-4 pt-3 pb-1">
        <h3 className="text-xs font-semibold text-cyan-400 tracking-wider uppercase">
          {schema.title}
        </h3>
      </div>

      <ScrollArea className="max-h-72 px-4 pb-2">
        <div className="grid grid-cols-2 gap-x-3 gap-y-2.5 pb-1">
          {schema.fields.map((field, idx) => {
            const sectionLabel = getSectionLabel(field.name);
            return (
              <div
                key={field.name}
                className={
                  field.field_type === "textarea" ||
                  field.name === "address" ||
                  field.name === "chief_complaint"
                    ? "col-span-2"
                    : "col-span-1"
                }
              >
                {sectionLabel && (
                  <p className="text-[10px] text-muted-foreground/60 uppercase tracking-wider mb-1.5 mt-1 font-medium">
                    {sectionLabel}
                  </p>
                )}
                <FormFieldInput
                  field={field}
                  value={values[field.name] ?? ""}
                  onChange={handleChange}
                  error={errors[field.name]}
                />
              </div>
            );
          })}
        </div>
      </ScrollArea>

      <div className="px-4 py-3 border-t border-border/40">
        <Button
          onClick={() => submit()}
          disabled={submitting}
          className="w-full bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-600 hover:to-teal-600 text-white h-9 text-sm"
        >
          {submitting ? (
            <><Loader2 className="w-4 h-4 animate-spin mr-2" />Submitting...</>
          ) : (
            "Submit Check-In"
          )}
        </Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add web/components/reception/form-input-bar.tsx
git commit -m "feat: add FormInputBar component — replaces input bar during form requests"
```

---

## Task 10: Wire Up the Intake Page

**Files:**
- Modify: `web/app/intake/use-intake-chat.ts`
- Modify: `web/app/intake/page.tsx`

- [ ] **Step 1: Update `use-intake-chat.ts` to handle `form_request` SSE events**

Open `web/app/intake/use-intake-chat.ts`. Add `ActiveForm` to imports and add `activeForm` state. The full updated file:

```typescript
// web/app/intake/use-intake-chat.ts
"use client";

import { useState, useRef, useEffect } from "react";
import type { ActiveForm } from "@/components/reception/form-input-bar";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
}

export interface TriageStatus {
  department: string;
  confidence: number;
  visitId?: string;
}

export function useIntakeChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [triageStatus, setTriageStatus] = useState<TriageStatus | null>(null);
  const [activeForm, setActiveForm] = useState<ActiveForm | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, triageStatus]);

  const sendMessage = async (e?: React.FormEvent, directMessage?: string) => {
    e?.preventDefault();
    const content = (directMessage ?? input).trim();
    if (!content || isLoading) return;

    setInput("");

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: "user",
      content,
    };
    setMessages((prev) => [...prev, userMsg]);
    setIsLoading(true);

    const assistantId = (Date.now() + 1).toString();
    setMessages((prev) => [
      ...prev,
      { id: assistantId, role: "assistant", content: "" },
    ]);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: content,
          stream: true,
          session_id: sessionId,
          agent_role: "reception_triage",
        }),
      });

      if (!response.ok) throw new Error("Failed to send message");

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      if (!reader) throw new Error("Response body is not readable");

      let accumulated = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        for (const line of chunk.split("\n")) {
          if (line.startsWith("data: ")) {
            try {
              const parsed = JSON.parse(line.slice(6));

              if (parsed.chunk) {
                accumulated += parsed.chunk;
                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === assistantId
                      ? { ...msg, content: accumulated }
                      : msg
                  )
                );
              }

              if (parsed.session_id && !sessionId) {
                setSessionId(parsed.session_id);
              }

              // Show the form — hide the input bar
              if (parsed.form_request) {
                setActiveForm(parsed.form_request as ActiveForm);
              }

              // Detect triage completion from tool results
              if (parsed.tool_result) {
                const resultText = parsed.tool_result.result || "";
                if (typeof resultText === "string" && resultText.includes("Triage completed")) {
                  const deptMatch = resultText.match(/Auto-routed to:\s*([^(]+)/);
                  const confMatch = resultText.match(/confidence:\s*([\d.]+)/);
                  if (deptMatch) {
                    setTriageStatus({
                      department: deptMatch[1].trim(),
                      confidence: confMatch ? parseFloat(confMatch[1]) : 0,
                    });
                  }
                }
              }

              if (parsed.done) break;
            } catch {
              // ignore malformed SSE lines
            }
          }
        }
      }
    } catch {
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantId
            ? { ...msg, content: "Connection error. Please try again." }
            : msg
        )
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleFormSubmitted = () => {
    setActiveForm(null);
  };

  const handleNewChat = () => {
    setMessages([]);
    setInput("");
    setSessionId(null);
    setTriageStatus(null);
    setActiveForm(null);
  };

  return {
    messages,
    input,
    setInput,
    isLoading,
    messagesEndRef,
    sendMessage,
    handleNewChat,
    triageStatus,
    activeForm,
    sessionId,
    handleFormSubmitted,
  };
}
```

- [ ] **Step 2: Update `page.tsx` to swap in FormInputBar**

Open `web/app/intake/page.tsx`. Add the import at the top (after the existing imports):

```tsx
import { FormInputBar } from "@/components/reception/form-input-bar";
```

Update the destructured hook return (add `activeForm`, `sessionId`, `handleFormSubmitted`):

```tsx
  const {
    messages,
    input,
    setInput,
    isLoading,
    messagesEndRef,
    sendMessage,
    handleNewChat,
    triageStatus,
    activeForm,
    sessionId,
    handleFormSubmitted,
  } = useIntakeChat();
```

Find the `{/* Input */}` section at the bottom of the page and replace the entire `<form ...>` block with:

```tsx
        {/* Input — swapped out for FormInputBar when agent requests a form */}
        {activeForm && sessionId ? (
          <FormInputBar
            activeForm={activeForm}
            sessionId={sessionId}
            onSubmitted={handleFormSubmitted}
          />
        ) : (
          <form
            onSubmit={sendMessage}
            className="py-4 border-t border-border/50 flex gap-2"
          >
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Tell us why you're visiting today..."
              disabled={isLoading || !!triageStatus}
              className="bg-card/50"
            />
            <Button
              type="submit"
              disabled={!input.trim() || isLoading || !!triageStatus}
              size="icon"
              className="bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-600 hover:to-teal-600 text-white flex-shrink-0"
            >
              <Send className="w-4 h-4" />
            </Button>
          </form>
        )}
```

- [ ] **Step 3: Build to check for TypeScript errors**

```bash
cd web && npx tsc --noEmit
```
Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add web/app/intake/use-intake-chat.ts web/app/intake/page.tsx
git commit -m "feat: wire FormInputBar into intake page — swaps input bar on form_request"
```

---

## Task 11: Manual Smoke Test

- [ ] **Step 1: Start the dev servers**

```bash
# Terminal 1 — backend
cd /path/to/medical_agent && uvicorn src.api.server:app --reload

# Terminal 2 — frontend
cd /path/to/medical_agent/web && npm run dev
```

- [ ] **Step 2: Verify patient_intake form**

1. Navigate to `http://localhost:3000/intake`
2. Send a message like "I'd like to check in"
3. Verify the reception agent replies and eventually calls `ask_user(template="patient_intake")`
4. Verify the text input bar disappears and the check-in form appears at the bottom
5. Fill in all required fields and click "Submit Check-In"
6. Verify the form disappears and the input bar returns
7. Verify the agent continues with its response

- [ ] **Step 3: Verify confirm_visit form**

1. After intake completes, the agent should call `ask_user(template="confirm_visit")`
2. Verify two large buttons (Confirm / Cancel) replace the input bar
3. Click Confirm
4. Verify the agent receives "confirmed" and proceeds

- [ ] **Step 4: Verify timeout (optional)**

1. Trigger a form request
2. Wait 5+ minutes without submitting
3. Verify the agent receives "form_timeout" and handles it gracefully

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "feat: agent form tool — complete implementation"
```

---

## Self-Review

**Spec coverage:**
- ✅ `ask_user(template)` tool — Task 6
- ✅ FormRequestRegistry with asyncio.Event — Task 5
- ✅ `patient_intake` and `confirm_visit` templates — Task 3
- ✅ Privacy vault (IntakeSubmission table, `save_intake()`) — Tasks 1, 2, 4
- ✅ SSE side-channel (racing queues in `generate()`) — Task 7
- ✅ `POST /api/chat/{session_id}/form-response` — Task 7
- ✅ Input bar replaced by FormInputBar — Tasks 8, 9, 10
- ✅ Agent receives status only, no PII — vault returns opaque IDs, `ask_user` returns those strings
- ✅ 5-minute timeout returns `"form_timeout"` — Task 6
- ✅ Alembic migration for `intake_submissions` — Task 2

**Type consistency check:**
- `ActiveForm.id` in frontend matches `form_request.payload.id` from backend ✅
- `save_intake()` signature: `(answers: dict[str, str]) -> tuple[int, str]` — used consistently in Tasks 4 and 7 ✅
- `FormRequestRegistry.register_form(form_id, event, template)` — 3-arg signature used consistently in Tasks 5, 6, 7 ✅
- `form_registry.resolve_form(form_id, result)` — 2-arg, used in Tasks 5 and 7 ✅
