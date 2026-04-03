# Patient Tracking Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a public `/track/[visitId]` page that shows a patient their agent-generated itinerary (ordered stops), queue position, doctor's notes, orders, and urgency — updating automatically as they move through the hospital.

**Architecture:** A new `VisitStep` model stores the ordered itinerary rows created by a new `set_itinerary` agent tool. The `/transfer` and `/check-in` endpoints auto-advance steps when a patient moves departments. A public `GET /api/visits/{id}/track` endpoint serves all tracking data in one call. The frontend polls every 10 seconds and renders a vertical roadmap.

**Tech Stack:** SQLAlchemy (sync + async), Alembic, FastAPI, LangGraph tool pattern, Next.js 14 App Router, Tailwind CSS, shadcn/ui

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `src/models/visit_step.py` | Create | VisitStep ORM model |
| `src/models/__init__.py` | Modify | Export VisitStep |
| `alembic/versions/004_add_visit_steps.py` | Create | DB migration |
| `src/tools/set_itinerary_tool.py` | Create | Agent tool: set_itinerary |
| `src/tools/__init__.py` | Modify | Import + re-export set_itinerary |
| `src/api/ws/events.py` | Modify | Add STEP_UPDATED event |
| `src/api/routers/visits.py` | Modify | Add track + step-complete endpoints, wire advance logic |
| `src/prompt/intake.py` | Modify | Add Step 5: set_itinerary instructions |
| `tests/test_set_itinerary_tool.py` | Create | Tool unit tests |
| `tests/test_visit_track_api.py` | Create | Track API integration tests |
| `web/app/track/[visitId]/page.tsx` | Create | Public tracking page (no auth) |
| `web/components/tracking/visit-tracker.tsx` | Create | Main tracking component |
| `web/components/tracking/step-item.tsx` | Create | Single step row |
| `web/components/reception/intake-chat.tsx` | Modify | Render tracking link in closing message |

---

## Task 1: VisitStep Model + Migration

**Files:**
- Create: `src/models/visit_step.py`
- Modify: `src/models/__init__.py`
- Create: `alembic/versions/004_add_visit_steps.py`

- [ ] **Step 1: Write the failing model import test**

```python
# tests/test_visit_step_model.py
def test_visit_step_model_importable():
    from src.models.visit_step import VisitStep, StepStatus
    s = VisitStep()
    assert hasattr(s, "visit_id")
    assert hasattr(s, "step_order")
    assert hasattr(s, "label")
    assert hasattr(s, "department")
    assert hasattr(s, "description")
    assert hasattr(s, "room")
    assert hasattr(s, "status")
    assert hasattr(s, "completed_at")


def test_step_status_enum_values():
    from src.models.visit_step import StepStatus
    assert StepStatus.PENDING.value == "pending"
    assert StepStatus.ACTIVE.value == "active"
    assert StepStatus.DONE.value == "done"


def test_visit_step_exported_from_models():
    from src.models import VisitStep
    assert VisitStep is not None
```

- [ ] **Step 2: Run test to verify it fails**

```bash
python -m pytest tests/test_visit_step_model.py -v
```

Expected: `ImportError: cannot import name 'VisitStep'`

- [ ] **Step 3: Create the VisitStep model**

```python
# src/models/visit_step.py
"""VisitStep model — one row per patient itinerary stop."""
import enum
from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, Enum, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base


class StepStatus(str, enum.Enum):
    PENDING = "pending"
    ACTIVE = "active"
    DONE = "done"


class VisitStep(Base):
    """A single stop in the patient's visit itinerary.

    Created by set_itinerary tool. First agent-provided step starts as
    ACTIVE; a Registration step is auto-prepended as DONE.
    """
    __tablename__ = "visit_steps"

    id: Mapped[int] = mapped_column(primary_key=True)
    visit_id: Mapped[int] = mapped_column(ForeignKey("visits.id"), index=True)
    step_order: Mapped[int] = mapped_column(Integer)
    # department FK is nullable — steps like "Blood Test Lab" may not map to a dept row
    department: Mapped[Optional[str]] = mapped_column(
        String(50), ForeignKey("departments.name"), nullable=True
    )
    label: Mapped[str] = mapped_column(String(200))
    description: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    room: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    status: Mapped[str] = mapped_column(
        Enum(StepStatus, values_callable=lambda x: [e.value for e in x]),
        default=StepStatus.PENDING.value,
    )
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=func.now())

    visit: Mapped["Visit"] = relationship(back_populates="steps")
```

- [ ] **Step 4: Add `steps` relationship to Visit model**

In `src/models/visit.py`, add to the relationships section at the bottom of the Visit class:

```python
    steps: Mapped[list["VisitStep"]] = relationship(
        "VisitStep", back_populates="visit", order_by="VisitStep.step_order"
    )
```

Also add the import at the top of the file (after existing imports):
```python
# Note: VisitStep is imported lazily via relationship string — no direct import needed
```

- [ ] **Step 5: Export VisitStep from models package**

In `src/models/__init__.py`, add after the `Visit` import line:
```python
from .visit_step import VisitStep, StepStatus
```

And add to `__all__`:
```python
    "VisitStep",
    "StepStatus",
```

- [ ] **Step 6: Run tests to verify they pass**

```bash
python -m pytest tests/test_visit_step_model.py -v
```

Expected: 3 PASSED

- [ ] **Step 7: Write the Alembic migration**

```python
# alembic/versions/004_add_visit_steps.py
"""Add visit_steps table.

Revision ID: 004_add_visit_steps
Revises: 003_drop_unused_intake_columns
Create Date: 2026-04-03
"""
from alembic import op
import sqlalchemy as sa

revision = "004_add_visit_steps"
down_revision = "003_drop_unused_intake_columns"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "visit_steps",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("visit_id", sa.Integer(), sa.ForeignKey("visits.id"), nullable=False, index=True),
        sa.Column("step_order", sa.Integer(), nullable=False),
        sa.Column("department", sa.String(50), sa.ForeignKey("departments.name"), nullable=True),
        sa.Column("label", sa.String(200), nullable=False),
        sa.Column("description", sa.String(500), nullable=True),
        sa.Column("room", sa.String(100), nullable=True),
        sa.Column(
            "status",
            sa.Enum("pending", "active", "done", name="stepstatus"),
            nullable=False,
            server_default="pending",
        ),
        sa.Column("completed_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table("visit_steps")
    op.execute("DROP TYPE IF EXISTS stepstatus")
```

- [ ] **Step 8: Run the migration**

```bash
alembic upgrade head
```

Expected: `Running upgrade 003_drop_unused_intake_columns -> 004_add_visit_steps, Add visit_steps table`

- [ ] **Step 9: Commit**

```bash
git add src/models/visit_step.py src/models/__init__.py src/models/visit.py \
        alembic/versions/004_add_visit_steps.py tests/test_visit_step_model.py
git commit -m "feat: add VisitStep model and migration for patient itinerary"
```

---

## Task 2: `set_itinerary` Agent Tool

**Files:**
- Create: `src/tools/set_itinerary_tool.py`
- Modify: `src/tools/__init__.py`
- Create: `tests/test_set_itinerary_tool.py`

- [ ] **Step 1: Write failing tests**

```python
# tests/test_set_itinerary_tool.py
"""Unit tests for set_itinerary tool."""
from unittest.mock import MagicMock, patch
from datetime import datetime


def _make_session_mock(*execute_results):
    mock_db = MagicMock()
    mock_db.execute.side_effect = list(execute_results)
    mock_cls = MagicMock()
    mock_cls.return_value.__enter__ = MagicMock(return_value=mock_db)
    mock_cls.return_value.__exit__ = MagicMock(return_value=False)
    return mock_cls, mock_db


def _scalar(val):
    r = MagicMock()
    r.scalar_one_or_none.return_value = val
    return r


def _scalars_all(items):
    r = MagicMock()
    r.scalars.return_value.all.return_value = items
    return r


def test_set_itinerary_unknown_visit_returns_error():
    mock_cls, _ = _make_session_mock(_scalar(None))
    with patch("src.tools.set_itinerary_tool.SessionLocal", mock_cls):
        from src.tools.set_itinerary_tool import set_itinerary
        result = set_itinerary(visit_id=9999, steps=[])
    assert "not found" in result.lower()


def test_set_itinerary_creates_registration_step_and_agent_steps():
    mock_visit = MagicMock()
    mock_visit.id = 1
    mock_visit.visit_id = "VIS-20260403-001"

    mock_cls, mock_db = _make_session_mock(
        _scalar(mock_visit),    # visit lookup
        _scalars_all([]),       # clear existing steps
    )

    steps = [
        {"order": 1, "department": "ent", "label": "ENT Department",
         "description": "Ear exam", "room": "Room 204"},
        {"order": 2, "department": None, "label": "Blood Test Lab",
         "description": "CBC panel", "room": "Lab A"},
    ]

    with patch("src.tools.set_itinerary_tool.SessionLocal", mock_cls):
        from src.tools.set_itinerary_tool import set_itinerary
        result = set_itinerary(visit_id=1, steps=steps)

    # Registration step + 2 agent steps = 3 adds
    assert mock_db.add.call_count == 3
    assert "Itinerary set" in result
    assert "/track/VIS-20260403-001" in result


def test_set_itinerary_registration_step_is_done():
    mock_visit = MagicMock()
    mock_visit.id = 1
    mock_visit.visit_id = "VIS-20260403-001"

    mock_cls, mock_db = _make_session_mock(
        _scalar(mock_visit),
        _scalars_all([]),
    )

    with patch("src.tools.set_itinerary_tool.SessionLocal", mock_cls):
        from src.tools.set_itinerary_tool import set_itinerary
        set_itinerary(visit_id=1, steps=[
            {"order": 1, "department": "ent", "label": "ENT", "description": "exam"}
        ])

    # First add call = Registration step
    reg_step = mock_db.add.call_args_list[0][0][0]
    assert reg_step.status == "done"
    assert reg_step.step_order == 1
    assert "Registration" in reg_step.label

    # Second add call = first agent step, should be ACTIVE
    first_step = mock_db.add.call_args_list[1][0][0]
    assert first_step.status == "active"
    assert first_step.step_order == 2


def test_set_itinerary_registered_in_tool_registry():
    from src.tools.registry import ToolRegistry
    import src.tools.set_itinerary_tool  # noqa: trigger registration
    reg = ToolRegistry()
    names = [t.name for t in reg.tools]
    assert "set_itinerary" in names
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
python -m pytest tests/test_set_itinerary_tool.py -v
```

Expected: `ImportError: cannot import name 'set_itinerary'`

- [ ] **Step 3: Create the tool**

```python
# src/tools/set_itinerary_tool.py
"""Built-in tool for setting a patient's visit itinerary.

Called by the Reception agent after complete_triage. Creates ordered
VisitStep rows, auto-prepends a Registration step (done), and activates
the first agent-provided step. Self-registers at import time.
"""
import logging
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import select

from src.models import SessionLocal
from src.models.visit import Visit
from src.models.visit_step import VisitStep, StepStatus
from src.tools.registry import ToolRegistry

logger = logging.getLogger(__name__)


def set_itinerary(visit_id: int, steps: list[dict]) -> str:
    """Define the ordered list of stops for a patient's visit itinerary.

    Call this after complete_triage to give the patient a clear roadmap.
    A 'Registration & Intake' step is automatically prepended as completed.
    The first step you provide becomes the active step.

    Args:
        visit_id: The visit DB id (from system context, e.g. 'Visit DB ID: 12')
        steps: Ordered list of stops. Each dict must have:
            - order (int): Position starting at 1 (will be shifted to 2+ internally)
            - label (str): Display name e.g. "ENT Department", "Blood Test Lab"
            - department (str | None): Department name key e.g. "ent", or None
            - description (str, optional): What happens here
            - room (str, optional): Room or location e.g. "Room 204, Floor 2"

    Returns:
        Confirmation message with tracking link to share with patient.
    """
    with SessionLocal() as db:
        visit = db.execute(
            select(Visit).where(Visit.id == visit_id)
        ).scalar_one_or_none()

        if not visit:
            return f"Error: Visit with id={visit_id} not found."

        # Clear any existing steps for this visit (idempotent)
        existing = db.execute(
            select(VisitStep).where(VisitStep.visit_id == visit_id)
        ).scalars().all()
        for s in existing:
            db.delete(s)
        db.flush()

        now = datetime.now(timezone.utc).replace(tzinfo=None)

        # Auto-prepend Registration step (always done — patient completed intake)
        reg_step = VisitStep(
            visit_id=visit_id,
            step_order=1,
            department=None,
            label="Registration & Intake",
            description="Completed at reception",
            room=None,
            status=StepStatus.DONE.value,
            completed_at=now,
        )
        db.add(reg_step)

        # Agent-provided steps start at order 2
        for i, step in enumerate(steps):
            is_first = i == 0
            db.add(VisitStep(
                visit_id=visit_id,
                step_order=i + 2,  # offset by 1 for the Registration step
                department=step.get("department"),
                label=step["label"],
                description=step.get("description"),
                room=step.get("room"),
                status=StepStatus.ACTIVE.value if is_first else StepStatus.PENDING.value,
                completed_at=None,
            ))

        db.commit()

    n = len(steps)
    first_label = steps[0]["label"] if steps else "none"
    logger.info("Itinerary set for visit %s: %d steps, first active: %s", visit.visit_id, n, first_label)

    return (
        f"Itinerary set: {n} step(s) created. "
        f"Step 1 ({first_label}) is now active.\n"
        f"Tracking link for patient: /track/{visit.visit_id}"
    )


_registry = ToolRegistry()
_registry.register(
    set_itinerary,
    scope="global",
    symbol="set_itinerary",
    allow_overwrite=True,
)
```

- [ ] **Step 4: Register the tool in `src/tools/__init__.py`**

Add after the `ask_user_input_tool` import line:
```python
from . import set_itinerary_tool
```

Add after the `ask_user_input` re-export:
```python
from .set_itinerary_tool import set_itinerary
```

Add to `__all__`:
```python
    "set_itinerary",
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
python -m pytest tests/test_set_itinerary_tool.py -v
```

Expected: 4 PASSED

- [ ] **Step 6: Commit**

```bash
git add src/tools/set_itinerary_tool.py src/tools/__init__.py \
        tests/test_set_itinerary_tool.py
git commit -m "feat: add set_itinerary agent tool for patient visit itinerary"
```

---

## Task 3: STEP_UPDATED Event + Step Auto-Advance Helper

**Files:**
- Modify: `src/api/ws/events.py`
- Modify: `src/api/routers/visits.py` (add `_advance_steps` helper only — wired in Task 4)

- [ ] **Step 1: Add STEP_UPDATED to events.py**

In `src/api/ws/events.py`, add to the `WSEventType` enum after `QUEUE_UPDATED`:
```python
    # Patient itinerary step advanced
    STEP_UPDATED = "step.updated"
```

Add to `NOTIFICATION_ROUTING` dict:
```python
    WSEventType.STEP_UPDATED:    {"bell": False, "inline": True,  "toast": False},
    WSEventType.VISIT_NOTES_UPDATED: {"bell": True,  "inline": True,  "toast": False},
```

- [ ] **Step 2: Add `_advance_steps` helper to visits.py**

Add this function near the top of `src/api/routers/visits.py`, after the existing imports. First add the import for VisitStep at the top of the file (in the existing `from src.models import ...` line):

Change:
```python
from src.models import get_db, Visit, Patient, ChatSession
```
To:
```python
from src.models import get_db, Visit, Patient, ChatSession, VisitStep
from src.models.visit_step import StepStatus
```

Then add the helper function after the `_generate_visit_id` function:

```python
async def _advance_steps(db: AsyncSession, visit_id: int, new_department: str) -> None:
    """Auto-advance visit steps when a patient moves to a new department.

    Marks the current ACTIVE step as DONE, then activates the next PENDING
    step whose department matches new_department — or simply the next step
    by step_order if no department match exists.

    Called inside check-in and transfer endpoint handlers before returning.
    """
    from datetime import datetime, timezone
    now = datetime.now(timezone.utc).replace(tzinfo=None)

    steps_result = await db.execute(
        select(VisitStep)
        .where(VisitStep.visit_id == visit_id)
        .order_by(VisitStep.step_order)
    )
    steps = steps_result.scalars().all()
    if not steps:
        return

    # Mark current active step as done
    for step in steps:
        if step.status == StepStatus.ACTIVE.value:
            step.status = StepStatus.DONE.value
            step.completed_at = now
            break

    # Find next step: prefer department match, fall back to next pending by order
    pending = [s for s in steps if s.status == StepStatus.PENDING.value]
    if not pending:
        return

    dept_match = next((s for s in pending if s.department == new_department), None)
    next_step = dept_match or pending[0]
    next_step.status = StepStatus.ACTIVE.value
```

- [ ] **Step 3: Commit**

```bash
git add src/api/ws/events.py src/api/routers/visits.py
git commit -m "feat: add STEP_UPDATED event and _advance_steps helper"
```

---

## Task 4: Track Endpoint + Step Complete Endpoint + Wire Auto-Advance

**Files:**
- Modify: `src/api/routers/visits.py`
- Create: `tests/test_visit_track_api.py`

- [ ] **Step 1: Write failing tests**

```python
# tests/test_visit_track_api.py
"""Integration tests for the visit tracking API."""
import pytest
import pytest_asyncio
from datetime import date
from httpx import AsyncClient, ASGITransport

from src.api.server import app
from src.models.base import get_db
from src.models.department import Department
from src.models.visit import Visit, VisitStatus
from src.models.visit_step import VisitStep, StepStatus
from src.models.patient import Patient


@pytest_asyncio.fixture
async def client(db_session):
    async def override_get_db():
        yield db_session
    app.dependency_overrides[get_db] = override_get_db
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c
    app.dependency_overrides.clear()


@pytest_asyncio.fixture
async def tracked_visit(db_session):
    """A visit with 3 itinerary steps: Registration(done), ENT(active), Lab(pending)."""
    dept = Department(name="ent", label="ENT", capacity=4, is_open=True,
                      color="#3b82f6", icon="Ear")
    db_session.add(dept)
    patient = Patient(name="Jordan Park", dob=date(1988, 11, 15), gender="male")
    db_session.add(patient)
    await db_session.flush()

    visit = Visit(
        visit_id="VIS-20260403-099",
        patient_id=patient.id,
        status=VisitStatus.IN_DEPARTMENT.value,
        current_department="ent",
        queue_position=1,
        chief_complaint="Ear pain",
        assigned_doctor="Dr. Nguyen",
        clinical_notes="Mild congestion",
        urgency_level="routine",
    )
    db_session.add(visit)
    await db_session.flush()

    steps = [
        VisitStep(visit_id=visit.id, step_order=1, label="Registration & Intake",
                  status=StepStatus.DONE.value, department=None),
        VisitStep(visit_id=visit.id, step_order=2, label="ENT Department",
                  description="Ear exam", room="Room 204",
                  department="ent", status=StepStatus.ACTIVE.value),
        VisitStep(visit_id=visit.id, step_order=3, label="Blood Test Lab",
                  description="CBC panel", room="Lab A",
                  department=None, status=StepStatus.PENDING.value),
    ]
    for s in steps:
        db_session.add(s)
    await db_session.commit()
    return visit


@pytest.mark.asyncio
async def test_track_endpoint_returns_visit_data(client, tracked_visit):
    resp = await client.get(f"/api/visits/{tracked_visit.id}/track")
    assert resp.status_code == 200
    data = resp.json()
    assert data["visit_id"] == "VIS-20260403-099"
    assert data["patient_name"] == "Jordan Park"
    assert data["chief_complaint"] == "Ear pain"
    assert data["assigned_doctor"] == "Dr. Nguyen"
    assert data["urgency_level"] == "routine"
    assert data["queue_position"] == 1


@pytest.mark.asyncio
async def test_track_endpoint_returns_steps_in_order(client, tracked_visit):
    resp = await client.get(f"/api/visits/{tracked_visit.id}/track")
    assert resp.status_code == 200
    steps = resp.json()["steps"]
    assert len(steps) == 3
    assert steps[0]["status"] == "done"
    assert steps[1]["status"] == "active"
    assert steps[1]["label"] == "ENT Department"
    assert steps[2]["status"] == "pending"


@pytest.mark.asyncio
async def test_track_endpoint_returns_empty_steps_when_none(client, db_session):
    patient = Patient(name="No Steps", dob=date(1990, 1, 1), gender="male")
    db_session.add(patient)
    await db_session.flush()
    visit = Visit(visit_id="VIS-20260403-100", patient_id=patient.id,
                  status=VisitStatus.IN_DEPARTMENT.value, current_department="ent",
                  queue_position=1)
    db_session.add(visit)
    await db_session.commit()
    resp = await client.get(f"/api/visits/{visit.id}/track")
    assert resp.status_code == 200
    assert resp.json()["steps"] == []


@pytest.mark.asyncio
async def test_track_endpoint_404_for_unknown_visit(client):
    resp = await client.get("/api/visits/9999/track")
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_step_complete_marks_done_and_advances(client, tracked_visit, db_session):
    # Get the active step (step_order=2)
    from sqlalchemy import select
    result = await db_session.execute(
        select(VisitStep)
        .where(VisitStep.visit_id == tracked_visit.id)
        .where(VisitStep.step_order == 2)
    )
    active_step = result.scalar_one()

    resp = await client.patch(
        f"/api/visits/{tracked_visit.id}/steps/{active_step.id}/complete"
    )
    assert resp.status_code == 200

    # Active step is now done
    await db_session.refresh(active_step)
    assert active_step.status == StepStatus.DONE.value
    assert active_step.completed_at is not None

    # Next pending step (step_order=3) is now active
    result3 = await db_session.execute(
        select(VisitStep)
        .where(VisitStep.visit_id == tracked_visit.id)
        .where(VisitStep.step_order == 3)
    )
    next_step = result3.scalar_one()
    assert next_step.status == StepStatus.ACTIVE.value


@pytest.mark.asyncio
async def test_step_complete_404_for_unknown_step(client, tracked_visit):
    resp = await client.patch(f"/api/visits/{tracked_visit.id}/steps/9999/complete")
    assert resp.status_code == 404
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
python -m pytest tests/test_visit_track_api.py -v
```

Expected: FAILED — endpoints not yet defined.

- [ ] **Step 3: Add track response model to `src/api/routers/models.py`**

First check where Pydantic models for visits live:

```bash
grep -n "VisitResponse" src/api/routers/models.py | head -5
```

Open `src/api/routers/models.py` (or wherever `VisitResponse` is defined — likely `src/api/models.py`) and add at the end:

```python
class StepResponse(BaseModel):
    id: int
    step_order: int
    label: str
    description: Optional[str] = None
    room: Optional[str] = None
    department: Optional[str] = None
    status: str
    completed_at: Optional[str] = None


class OrderSummary(BaseModel):
    order_name: str
    order_type: str
    status: str


class VisitTrackResponse(BaseModel):
    visit_id: str
    patient_name: str
    status: str
    urgency_level: Optional[str] = None
    chief_complaint: Optional[str] = None
    assigned_doctor: Optional[str] = None
    current_department: Optional[str] = None
    queue_position: Optional[int] = None
    clinical_notes: Optional[str] = None
    steps: list[StepResponse] = []
    orders: list[OrderSummary] = []
```

Add `Optional` to the imports at the top if not already present:
```python
from typing import Optional
```

- [ ] **Step 4: Add the track and step-complete endpoints to visits.py**

Find where `src/api/routers/models.py` is actually imported in `visits.py`. It uses:
```python
from ..models import VisitCreate, VisitResponse, ...
```

Add `VisitTrackResponse, StepResponse, OrderSummary` to that import.

Then add these two endpoints at the end of `src/api/routers/visits.py`:

```python
@router.get("/api/visits/{visit_id}/track", response_model=VisitTrackResponse)
async def get_visit_track(visit_id: int, db: AsyncSession = Depends(get_db)):
    """Public endpoint — returns all tracking data for a visit in one call.

    No authentication required. Used by /track/[visitId] frontend page.
    Polled every 10 seconds for real-time updates.
    """
    result = await db.execute(select(Visit).where(Visit.id == visit_id))
    visit = result.scalar_one_or_none()
    if not visit:
        raise HTTPException(status_code=404, detail="Visit not found")

    patient_result = await db.execute(select(Patient).where(Patient.id == visit.patient_id))
    patient = patient_result.scalar_one_or_none()

    steps_result = await db.execute(
        select(VisitStep)
        .where(VisitStep.visit_id == visit_id)
        .order_by(VisitStep.step_order)
    )
    steps = [
        StepResponse(
            id=s.id,
            step_order=s.step_order,
            label=s.label,
            description=s.description,
            room=s.room,
            department=s.department,
            status=s.status,
            completed_at=s.completed_at.isoformat() if s.completed_at else None,
        )
        for s in steps_result.scalars().all()
    ]

    from src.models.order import Order
    orders_result = await db.execute(
        select(Order).where(Order.visit_id == visit_id)
    )
    orders = [
        OrderSummary(
            order_name=o.order_name,
            order_type=o.order_type,
            status=o.status,
        )
        for o in orders_result.scalars().all()
    ]

    return VisitTrackResponse(
        visit_id=visit.visit_id,
        patient_name=patient.name if patient else "Unknown",
        status=visit.status,
        urgency_level=visit.urgency_level,
        chief_complaint=visit.chief_complaint,
        assigned_doctor=visit.assigned_doctor,
        current_department=visit.current_department,
        queue_position=visit.queue_position,
        clinical_notes=visit.clinical_notes,
        steps=steps,
        orders=orders,
    )


@router.patch("/api/visits/{visit_id}/steps/{step_id}/complete")
async def complete_visit_step(
    visit_id: int,
    step_id: int,
    db: AsyncSession = Depends(get_db),
):
    """Staff override: mark a specific itinerary step as done.

    Auto-activates the next pending step by step_order.
    """
    from datetime import datetime, timezone
    now = datetime.now(timezone.utc).replace(tzinfo=None)

    result = await db.execute(
        select(VisitStep)
        .where(VisitStep.id == step_id)
        .where(VisitStep.visit_id == visit_id)
    )
    step = result.scalar_one_or_none()
    if not step:
        raise HTTPException(status_code=404, detail="Step not found")

    step.status = StepStatus.DONE.value
    step.completed_at = now

    # Activate next pending step
    next_result = await db.execute(
        select(VisitStep)
        .where(VisitStep.visit_id == visit_id)
        .where(VisitStep.status == StepStatus.PENDING.value)
        .order_by(VisitStep.step_order)
        .limit(1)
    )
    next_step = next_result.scalar_one_or_none()
    if next_step:
        next_step.status = StepStatus.ACTIVE.value

    await db.commit()

    await event_bus.emit_to_room(
        step.department or "all",
        WSEventType.STEP_UPDATED,
        {"visit_id": visit_id, "step_id": step_id, "status": "done"},
    )

    return {"status": "ok", "step_id": step_id}
```

- [ ] **Step 5: Wire `_advance_steps` into check-in and transfer endpoints**

In `check_in_visit`, add the call right before `await db.commit()`:

```python
    # Auto-advance matching itinerary step
    await _advance_steps(db, visit.id, visit.current_department)
    await db.commit()
```

In `transfer_visit`, add the call right before `await db.commit()`:

```python
    # Auto-advance matching itinerary step
    await _advance_steps(db, visit.id, transfer.target_department)
    await db.commit()
```

Also emit STEP_UPDATED in both places after the existing event_bus calls. In `check_in_visit`, after emitting `VISIT_CHECKED_IN`:
```python
    await event_bus.emit_to_room(visit.current_department, WSEventType.STEP_UPDATED, {
        "visit_id": visit.visit_id,
        "new_department": visit.current_department,
    })
```

In `transfer_visit`, after the existing VISIT_TRANSFERRED emissions:
```python
    await event_bus.emit_to_room(transfer.target_department, WSEventType.STEP_UPDATED, {
        "visit_id": visit.visit_id,
        "new_department": transfer.target_department,
    })
```

- [ ] **Step 6: Run all tests**

```bash
python -m pytest tests/test_visit_track_api.py tests/test_visit_transfer.py -v
```

Expected: All PASSED (including existing transfer tests — no regressions)

- [ ] **Step 7: Commit**

```bash
git add src/api/routers/visits.py src/api/models.py \
        tests/test_visit_track_api.py
git commit -m "feat: add GET /track and PATCH /steps/:id/complete endpoints, wire auto-advance"
```

---

## Task 5: Intake Prompt Update

**Files:**
- Modify: `src/prompt/intake.py`

- [ ] **Step 1: Replace Step 5 in the intake prompt**

In `src/prompt/intake.py`, find the existing `### Step 5 — Warm Closing` section and replace it with the updated version that adds itinerary generation before the closing:

```python
### Step 5 — Set Patient Itinerary

After `complete_triage` returns with a successful routing, call `set_itinerary` \
with the patient's complete multi-stop route in the correct order. Check which \
departments or locations the patient needs to visit based on their symptoms and \
the routing decision.

```
set_itinerary(
    visit_id=<visit_db_id>,   # same numeric id used in complete_triage
    steps=[
        {"order": 1, "department": "<dept_key>", "label": "<display_name>",
         "description": "<what happens here>", "room": "<room if known>"},
        # ... more steps if needed
    ]
)
```

- Include every stop the patient must make in order (primary department first)
- Use `department: null` for stops without a matching department (labs, imaging rooms)
- The tool returns a tracking link — **include it in your closing message to the patient**

If `complete_triage` returned a pending-review result (confidence < 0.70), skip \
`set_itinerary` — the routing is not yet confirmed.

---

### Step 6 — Warm Closing

After `complete_triage` (and `set_itinerary` if auto-routed), give the patient \
a brief, warm closing message:

- **Auto-routed (confidence ≥ 0.70)**: Tell them which department or team will \
be seeing them, share the tracking link from `set_itinerary`, reassure them they \
are in good hands.
- **Pending review (confidence < 0.70)**: Explain that one of the medical team \
will briefly review their information first and then direct them — this is routine \
and will not take long.

End on a caring, reassuring note.
```

- [ ] **Step 2: Verify prompt still loads**

```bash
python -c "from src.prompt.intake import INTAKE_SYSTEM_PROMPT; print('OK', len(INTAKE_SYSTEM_PROMPT))"
```

Expected: `OK <number greater than 100>`

- [ ] **Step 3: Run intake redesign tests to confirm no regression**

```bash
python -m pytest tests/test_intake_redesign.py -v
```

Expected: All PASSED

- [ ] **Step 4: Commit**

```bash
git add src/prompt/intake.py
git commit -m "feat(prompt): add Step 5 set_itinerary + update closing to include tracking link"
```

---

## Task 6: Frontend Tracking Page

**Files:**
- Create: `web/app/track/[visitId]/page.tsx`
- Create: `web/components/tracking/step-item.tsx`
- Create: `web/components/tracking/visit-tracker.tsx`

- [ ] **Step 1: Create the StepItem component**

```tsx
// web/components/tracking/step-item.tsx
"use client";

import { CheckCircle, Circle, Loader2, MapPin } from "lucide-react";

export interface Step {
  id: number;
  step_order: number;
  label: string;
  description: string | null;
  room: string | null;
  department: string | null;
  status: "pending" | "active" | "done";
  completed_at: string | null;
}

interface StepItemProps {
  step: Step;
  isLast: boolean;
  queuePosition?: number | null;
  clinicalNotes?: string | null;
}

export function StepItem({ step, isLast, queuePosition, clinicalNotes }: StepItemProps) {
  const isDone = step.status === "done";
  const isActive = step.status === "active";

  return (
    <div className="flex gap-3">
      {/* Timeline column */}
      <div className="flex flex-col items-center flex-shrink-0 w-6">
        {isDone ? (
          <CheckCircle className="w-6 h-6 text-green-500 flex-shrink-0" />
        ) : isActive ? (
          <div className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center text-white text-xs font-bold ring-4 ring-blue-500/20 flex-shrink-0">
            {step.step_order}
          </div>
        ) : (
          <Circle className="w-6 h-6 text-muted-foreground/40 flex-shrink-0" strokeDasharray="4 2" />
        )}
        {!isLast && (
          <div className={`w-0.5 flex-1 mt-1 min-h-4 ${isDone ? "bg-green-500/30" : "bg-border"}`} />
        )}
      </div>

      {/* Content column */}
      <div className={`pb-5 flex-1 ${!isLast ? "" : ""}`}>
        <div className={`text-sm font-semibold ${isDone ? "line-through text-muted-foreground" : isActive ? "text-blue-400" : "text-muted-foreground/60"}`}>
          {step.label}
        </div>

        {isDone && step.completed_at && (
          <div className="text-xs text-muted-foreground mt-0.5">
            Completed · {new Date(step.completed_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </div>
        )}

        {isActive && (
          <div className="mt-2 rounded-lg border border-blue-500/30 bg-blue-950/40 p-3 space-y-2">
            {step.description && (
              <p className="text-xs text-blue-300">{step.description}</p>
            )}
            {step.room && (
              <div className="flex items-center gap-1.5 text-xs text-blue-400">
                <MapPin className="w-3 h-3" />
                {step.room}
              </div>
            )}
            {queuePosition != null && (
              <div className="flex items-center gap-2 pt-1 border-t border-blue-500/20">
                <Loader2 className="w-3 h-3 animate-spin text-blue-400" />
                <span className="text-xs text-blue-300">
                  {queuePosition === 1 ? "You're next!" : `Queue position #${queuePosition}`}
                </span>
              </div>
            )}
            {clinicalNotes && (
              <div className="pt-2 border-t border-blue-500/20">
                <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Doctor&apos;s note</div>
                <p className="text-xs text-slate-300 italic">&quot;{clinicalNotes}&quot;</p>
              </div>
            )}
          </div>
        )}

        {!isActive && !isDone && step.description && (
          <div className="text-xs text-muted-foreground/50 mt-0.5">{step.description}</div>
        )}

        {!isActive && !isDone && step.room && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground/40 mt-0.5">
            <MapPin className="w-2.5 h-2.5" />
            {step.room}
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create the VisitTracker component**

```tsx
// web/components/tracking/visit-tracker.tsx
"use client";

import { useEffect, useState, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { User, Stethoscope, RefreshCw, FlaskConical } from "lucide-react";
import { StepItem, type Step } from "./step-item";

interface Order {
  order_name: string;
  order_type: string;
  status: string;
}

interface TrackingData {
  visit_id: string;
  patient_name: string;
  status: string;
  urgency_level: string | null;
  chief_complaint: string | null;
  assigned_doctor: string | null;
  current_department: string | null;
  queue_position: number | null;
  clinical_notes: string | null;
  steps: Step[];
  orders: Order[];
}

const URGENCY_COLORS: Record<string, string> = {
  routine: "bg-green-950 text-green-400 border-green-800",
  urgent: "bg-yellow-950 text-yellow-400 border-yellow-800",
  critical: "bg-red-950 text-red-400 border-red-800",
};

const ORDER_STATUS_COLORS: Record<string, string> = {
  pending: "text-yellow-400",
  in_progress: "text-blue-400",
  completed: "text-green-400",
  cancelled: "text-muted-foreground",
};

interface VisitTrackerProps {
  visitId: string;
  initialData: TrackingData;
}

export function VisitTracker({ visitId, initialData }: VisitTrackerProps) {
  const [data, setData] = useState<TrackingData>(initialData);
  const [lastUpdated, setLastUpdated] = useState(new Date());

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`/api/proxy/visits/${visitId}/track`);
      if (res.ok) {
        const fresh = await res.json();
        setData(fresh);
        setLastUpdated(new Date());
      }
    } catch {
      // Silently ignore network errors — stale data is better than a crash
    }
  }, [visitId]);

  // Poll every 10 seconds
  useEffect(() => {
    const id = setInterval(refresh, 10_000);
    return () => clearInterval(id);
  }, [refresh]);

  const activeStep = data.steps.find((s) => s.status === "active");
  const urgencyClass = data.urgency_level ? URGENCY_COLORS[data.urgency_level] ?? URGENCY_COLORS.routine : URGENCY_COLORS.routine;

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <div className="border-b border-border/50 px-4 py-3 flex justify-between items-center">
        <span className="font-semibold text-sm">🏥 City Hospital</span>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">{data.visit_id}</span>
          <span className="text-xs text-muted-foreground/50">
            · {lastUpdated.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </span>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-5 space-y-4">
        {/* Patient info */}
        <div>
          <h1 className="text-xl font-bold">{data.patient_name}</h1>
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            <Badge variant="outline" className="text-blue-400 border-blue-800 bg-blue-950">
              {data.status.replace(/_/g, " ")}
            </Badge>
            {data.urgency_level && (
              <Badge variant="outline" className={urgencyClass}>
                {data.urgency_level.charAt(0).toUpperCase() + data.urgency_level.slice(1)}
              </Badge>
            )}
          </div>
        </div>

        {/* Chief complaint */}
        {data.chief_complaint && (
          <Card className="px-4 py-3 border-l-2 border-l-muted-foreground/30 rounded-l-none">
            <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Chief Complaint</div>
            <p className="text-sm text-muted-foreground">&quot;{data.chief_complaint}&quot;</p>
          </Card>
        )}

        {/* Assigned doctor */}
        {data.assigned_doctor && (
          <Card className="px-4 py-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <User className="w-4 h-4 text-primary" />
              </div>
              <div>
                <div className="text-xs text-muted-foreground uppercase tracking-wider">Assigned Doctor</div>
                <div className="text-sm font-semibold">{data.assigned_doctor}</div>
                {data.current_department && (
                  <div className="text-xs text-muted-foreground capitalize">
                    {data.current_department.replace(/_/g, " ")}
                  </div>
                )}
              </div>
            </div>
          </Card>
        )}

        {/* Orders */}
        {data.orders.length > 0 && (
          <Card className="px-4 py-3">
            <div className="flex items-center gap-2 mb-3">
              <FlaskConical className="w-4 h-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground uppercase tracking-wider">Tests & Orders</span>
            </div>
            <div className="space-y-2">
              {data.orders.map((order, i) => (
                <div key={i} className="flex justify-between items-center">
                  <div className="text-sm">{order.order_name}</div>
                  <div className={`text-xs font-medium ${ORDER_STATUS_COLORS[order.status] ?? "text-muted-foreground"}`}>
                    {order.status.replace(/_/g, " ")}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Itinerary */}
        {data.steps.length > 0 && (
          <div>
            <div className="text-xs text-muted-foreground uppercase tracking-wider mb-3">Your Journey Today</div>
            <div>
              {data.steps.map((step, i) => (
                <StepItem
                  key={step.id}
                  step={step}
                  isLast={i === data.steps.length - 1}
                  queuePosition={step.status === "active" ? data.queue_position : null}
                  clinicalNotes={step.status === "active" ? data.clinical_notes : null}
                />
              ))}
            </div>
          </div>
        )}

        {/* Completed state */}
        {data.status === "completed" && (
          <Card className="px-4 py-4 text-center border-green-800 bg-green-950/30">
            <div className="text-green-400 font-semibold">Visit Complete</div>
            <p className="text-sm text-muted-foreground mt-1">Thank you for visiting. We hope you feel better soon!</p>
          </Card>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create the API proxy route for the tracking page**

Since the tracking page is a Next.js public page that needs to call the backend, create a proxy API route:

```ts
// web/app/api/track/[visitId]/route.ts
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  _req: NextRequest,
  { params }: { params: { visitId: string } }
) {
  const backendUrl = process.env.BACKEND_URL ?? "http://localhost:8000";
  const res = await fetch(`${backendUrl}/api/visits/${params.visitId}/track`, {
    cache: "no-store",
  });
  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
```

Note: `VisitTracker` calls `/api/proxy/visits/${visitId}/track` — update the fetch URL in `visit-tracker.tsx` to match the route you create. Use `/api/track/${visitId}` to match the route above:

In `visit-tracker.tsx`, change:
```tsx
const res = await fetch(`/api/proxy/visits/${visitId}/track`);
```
To:
```tsx
const res = await fetch(`/api/track/${visitId}`);
```

- [ ] **Step 4: Create the tracking page**

```tsx
// web/app/track/[visitId]/page.tsx
import { notFound } from "next/navigation";
import { VisitTracker } from "@/components/tracking/visit-tracker";

interface Props {
  params: { visitId: string };
}

async function getTrackingData(visitId: string) {
  const backendUrl = process.env.BACKEND_URL ?? "http://localhost:8000";
  const res = await fetch(`${backendUrl}/api/visits/${visitId}/track`, {
    cache: "no-store",
  });
  if (!res.ok) return null;
  return res.json();
}

export default async function TrackPage({ params }: Props) {
  const data = await getTrackingData(params.visitId);
  if (!data) notFound();

  return (
    <VisitTracker
      visitId={params.visitId}
      initialData={data}
    />
  );
}

export const metadata = {
  title: "Visit Tracking · City Hospital",
};
```

- [ ] **Step 5: Verify page renders**

Start the dev server and open `http://localhost:3000/track/VIS-20260403-001` (use a real visit ID from your DB).

```bash
cd web && npm run dev
```

Expected: Page loads showing patient name, itinerary steps, assigned doctor.

- [ ] **Step 6: Commit**

```bash
git add web/app/track/ web/app/api/track/ \
        web/components/tracking/
git commit -m "feat: add public patient tracking page with vertical roadmap"
```

---

## Task 7: Tracking Link in Intake Chat

**Files:**
- Modify: `web/components/reception/intake-chat.tsx`

The agent's closing message includes the text `/track/VIS-YYYYMMDD-NNN`. The `IntakeChat` component must detect this pattern and render a styled link button below the last assistant message.

- [ ] **Step 1: Add tracking link detection to intake-chat.tsx**

Add a helper at the top of the file (after imports):

```tsx
const TRACK_LINK_PATTERN = /\/track\/(VIS-[\d]+-[\d]+)/;

function extractTrackingLink(content: string): string | null {
  const match = content.match(TRACK_LINK_PATTERN);
  return match ? `/track/${match[1]}` : null;
}
```

- [ ] **Step 2: Update message rendering to show the link**

In the `messages.map` block, wrap the message content div to add a tracking button when detected. Replace the current inner message content rendering:

```tsx
{messages.map((msg) => (
  <div
    key={msg.id}
    className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
  >
    <div className="max-w-[80%] space-y-2">
      <div
        className={`px-3 py-2 rounded-xl text-sm ${
          msg.role === "user"
            ? "bg-primary/15 text-foreground"
            : "bg-muted/50 text-foreground"
        }`}
      >
        {msg.content || (
          isLoading && msg.role === "assistant" ? (
            <div className="flex flex-col gap-1.5">
              {activityStatus ? (
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  {activityStatus}
                </span>
              ) : isThinking ? (
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <Brain className="w-3.5 h-3.5" />
                  <span className="flex gap-0.5">
                    {[0, 200, 400].map((delay) => (
                      <span
                        key={delay}
                        className="w-1 h-1 rounded-full bg-muted-foreground animate-bounce"
                        style={{ animationDelay: `${delay}ms`, animationDuration: "1.2s" }}
                      />
                    ))}
                  </span>
                </span>
              ) : (
                <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
              )}
            </div>
          ) : (
            <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
          )
        )}
      </div>
      {msg.role === "assistant" && msg.content && (() => {
        const trackHref = extractTrackingLink(msg.content);
        return trackHref ? (
          <a
            href={trackHref}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-3 py-2 rounded-lg border border-green-700 bg-green-950/40 text-green-400 text-xs font-medium hover:bg-green-950/70 transition-colors"
          >
            🔗 Track your visit progress
          </a>
        ) : null;
      })()}
    </div>
  </div>
))}
```

- [ ] **Step 3: Add the ExternalLink icon import**

The link already uses an emoji. Verify `Loader2`, `Send`, `Brain` are still imported (they should be unchanged).

- [ ] **Step 4: Test manually**

In the intake chat, after a successful triage, the agent's closing message should contain `/track/VIS-...` and a green "Track your visit progress" button should appear below it.

- [ ] **Step 5: Commit**

```bash
git add web/components/reception/intake-chat.tsx
git commit -m "feat(intake): render tracking link button in agent closing message"
```

---

## Self-Review Notes

- `VisitStep.visit` relationship uses `back_populates="steps"` — ensure Visit model has `steps = relationship(...)` added in Task 1 Step 4.
- `_advance_steps` is called before `db.commit()` in both check-in and transfer — if no steps exist it returns early (no-op).
- `GET /api/visits/{id}/track` is intentionally unauthenticated — the visit ID is the access token. This is consistent with the spec.
- The tracking page fetches from the backend at server render time (SSR) for fast initial load, then polls client-side every 10 seconds.
- `StepStatus` is imported from `src.models.visit_step` in `visits.py` — ensure this import is added alongside `VisitStep`.
