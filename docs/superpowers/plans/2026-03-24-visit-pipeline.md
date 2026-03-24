# Unified Visit Pipeline — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace separate Reception and Doctor Queue pages with a unified Kanban pipeline view, and add agent tools for autonomous patient/visit creation.

**Architecture:** Backend-first approach — new agent tools (`find_patient`, `create_patient`), enhanced visits API (multi-status filter, patient_name in list, check-in/complete endpoints), then frontend pipeline page with Kanban + Detail Panel layout. Agent system prompt updated to drive autonomous intake.

**Tech Stack:** Python/FastAPI, SQLAlchemy async, LangGraph agent, Next.js 16, React 19, shadcn/ui, Tailwind CSS

**Spec:** `docs/superpowers/specs/2026-03-24-visit-pipeline-design.md`

---

## File Structure

### New Files

| File | Responsibility |
|------|---------------|
| `src/tools/builtin/find_patient_tool.py` | Agent tool: search patients by name/DOB |
| `src/tools/builtin/create_patient_tool.py` | Agent tool: create new patient record |
| `src/tools/builtin/create_visit_tool.py` | Agent tool: create visit for a patient (links chat session) |
| `web/components/pipeline/pipeline-constants.ts` | Status colors, column definitions, shared types |
| `web/components/pipeline/kanban-board.tsx` | Kanban columns layout with visit cards |
| `web/components/pipeline/visit-card.tsx` | Individual visit card component |
| `web/components/pipeline/detail-panel.tsx` | Stage-adaptive detail panel (delegates to sub-components) |
| `web/components/pipeline/intake-detail.tsx` | Detail content for intake stage |
| `web/components/pipeline/review-detail.tsx` | Detail content for auto_routed/pending_review stages |
| `web/components/pipeline/routed-detail.tsx` | Detail content for routed stage |
| `web/components/pipeline/department-detail.tsx` | Detail content for in_department stage |
| `web/app/(dashboard)/pipeline/page.tsx` | Pipeline page (layout, polling, state management) |
| `tests/unit/test_find_patient_tool.py` | Tests for find_patient tool |
| `tests/unit/test_create_patient_tool.py` | Tests for create_patient tool |
| `tests/unit/test_visit_endpoints.py` | Tests for new/modified visit API endpoints |

**Note:** `find_patient` overlaps with the existing `query_patient_basic_info` tool but is intentionally simpler — it has a focused interface for the autonomous intake flow (just `name` + `dob`) without the `query`/`patient_id` params that are irrelevant during intake.

### Modified Files

| File | Change |
|------|--------|
| `src/tools/builtin/__init__.py` | Register new tools |
| `src/api/models.py` | Add `VisitListResponse` with `patient_name`, add `VisitStatusUpdate` model |
| `src/api/routers/visits.py` | Add `exclude_status` param to list, add `patient_name` to list response, add check-in/complete endpoints |
| `web/lib/api.ts` | Add `listActiveVisits()`, `checkInVisit()`, `completeVisit()`, update `Visit` type |
| `web/components/sidebar.tsx` | Replace Reception + Doctor Queue with Pipeline nav item |

### Removed Files

| File | Reason |
|------|--------|
| `web/app/(dashboard)/reception/page.tsx` | Replaced by pipeline |
| `web/app/(dashboard)/doctor/queue/page.tsx` | Replaced by pipeline |
| `web/components/reception/patient-selector.tsx` | No longer needed (agent creates visits) |
| `web/components/reception/visit-info-card.tsx` | Replaced by detail panel |
| `web/components/doctor/visit-queue-card.tsx` | Replaced by visit-card.tsx |

---

## Task 1: Agent Tool — find_patient

**Files:**
- Create: `src/tools/builtin/find_patient_tool.py`
- Create: `tests/unit/test_find_patient_tool.py`
- Modify: `src/tools/builtin/__init__.py`

- [ ] **Step 1: Write the test file**

```python
# tests/unit/test_find_patient_tool.py
"""Tests for find_patient agent tool."""
import pytest
from unittest.mock import patch, MagicMock
from src.tools.builtin.find_patient_tool import find_patient


class TestFindPatient:
    """Test patient search functionality."""

    @patch("src.tools.builtin.find_patient_tool.SessionLocal")
    def test_find_by_exact_name(self, mock_session_cls):
        """Should return matching patients when name matches."""
        mock_db = MagicMock()
        mock_session_cls.return_value.__enter__ = MagicMock(return_value=mock_db)
        mock_session_cls.return_value.__exit__ = MagicMock(return_value=False)

        mock_patient = MagicMock()
        mock_patient.id = 1
        mock_patient.name = "Clara Nguyen"
        mock_patient.dob = "1990-06-15"
        mock_patient.gender = "female"
        mock_db.execute.return_value.scalars.return_value.all.return_value = [mock_patient]

        result = find_patient(name="Clara Nguyen")
        assert "Clara Nguyen" in result
        assert "1990-06-15" in result

    @patch("src.tools.builtin.find_patient_tool.SessionLocal")
    def test_find_no_results(self, mock_session_cls):
        """Should return helpful message when no patients found."""
        mock_db = MagicMock()
        mock_session_cls.return_value.__enter__ = MagicMock(return_value=mock_db)
        mock_session_cls.return_value.__exit__ = MagicMock(return_value=False)
        mock_db.execute.return_value.scalars.return_value.all.return_value = []

        result = find_patient(name="Nobody Here")
        assert "No patients found" in result

    @patch("src.tools.builtin.find_patient_tool.SessionLocal")
    def test_find_with_dob_filter(self, mock_session_cls):
        """Should filter by DOB when provided."""
        mock_db = MagicMock()
        mock_session_cls.return_value.__enter__ = MagicMock(return_value=mock_db)
        mock_session_cls.return_value.__exit__ = MagicMock(return_value=False)
        mock_db.execute.return_value.scalars.return_value.all.return_value = []

        find_patient(name="Clara", dob="1990-06-15")
        # Verify the query was called (the mock captures the call)
        assert mock_db.execute.called
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /Users/kien.ha/Code/medical_agent && python -m pytest tests/unit/test_find_patient_tool.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'src.tools.builtin.find_patient_tool'`

- [ ] **Step 3: Implement find_patient tool**

```python
# src/tools/builtin/find_patient_tool.py
"""Built-in tool for searching patient records.

Called by the Reception agent to find existing patients by name/DOB.
Self-registers at import time.
"""
import logging
from typing import Optional

from sqlalchemy import select, func
from src.models import SessionLocal
from src.models.patient import Patient
from src.tools.registry import ToolRegistry

logger = logging.getLogger(__name__)


def find_patient(name: str, dob: Optional[str] = None) -> str:
    """Search for existing patients by name and optionally date of birth.

    Call this to check if a patient already exists in the system before
    creating a new record.

    Args:
        name: Patient name to search for (case-insensitive partial match)
        dob: Date of birth to filter by (format: YYYY-MM-DD), optional

    Returns:
        Formatted list of matching patients, or a message if none found
    """
    with SessionLocal() as db:
        query = select(Patient).where(
            func.lower(Patient.name).contains(name.lower())
        )
        if dob:
            query = query.where(Patient.dob == dob)

        query = query.limit(10)
        results = db.execute(query).scalars().all()

        if not results:
            return f"No patients found matching name='{name}'" + (
                f" and dob='{dob}'" if dob else ""
            ) + ". You may need to create a new patient record."

        lines = [f"Found {len(results)} patient(s):"]
        for p in results:
            lines.append(f"- ID: {p.id}, Name: {p.name}, DOB: {p.dob}, Gender: {p.gender}")
        return "\n".join(lines)


_registry = ToolRegistry()
_registry.register(
    find_patient,
    scope="assignable",
    symbol="find_patient",
    allow_overwrite=True,
)
```

- [ ] **Step 4: Register in __init__.py**

Add to `src/tools/builtin/__init__.py`:
- Import: `from . import find_patient_tool`
- Function import: `from .find_patient_tool import find_patient`
- Add `"find_patient"` to `__all__`

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd /Users/kien.ha/Code/medical_agent && python -m pytest tests/unit/test_find_patient_tool.py -v`
Expected: 3 tests PASS

- [ ] **Step 6: Commit**

```bash
git add src/tools/builtin/find_patient_tool.py tests/unit/test_find_patient_tool.py src/tools/builtin/__init__.py
git commit -m "feat: add find_patient agent tool for patient search"
```

---

## Task 2: Agent Tool — create_patient

**Files:**
- Create: `src/tools/builtin/create_patient_tool.py`
- Create: `tests/unit/test_create_patient_tool.py`
- Modify: `src/tools/builtin/__init__.py`

- [ ] **Step 1: Write the test file**

```python
# tests/unit/test_create_patient_tool.py
"""Tests for create_patient agent tool."""
import pytest
from unittest.mock import patch, MagicMock
from src.tools.builtin.create_patient_tool import create_patient


class TestCreatePatient:
    """Test patient creation functionality."""

    @patch("src.tools.builtin.create_patient_tool.SessionLocal")
    def test_create_patient_success(self, mock_session_cls):
        """Should create patient and return confirmation."""
        mock_db = MagicMock()
        mock_session_cls.return_value.__enter__ = MagicMock(return_value=mock_db)
        mock_session_cls.return_value.__exit__ = MagicMock(return_value=False)

        # Mock the flush to set the ID
        def set_id(patient):
            patient.id = 42
        mock_db.add.side_effect = lambda p: setattr(p, 'id', 42)

        result = create_patient(name="Clara Nguyen", dob="1990-06-15", gender="female")
        assert "Clara Nguyen" in result
        assert mock_db.add.called
        assert mock_db.commit.called

    @patch("src.tools.builtin.create_patient_tool.SessionLocal")
    def test_create_patient_missing_name(self, mock_session_cls):
        """Should return error for empty name."""
        result = create_patient(name="", dob="1990-06-15", gender="female")
        assert "Error" in result

    @patch("src.tools.builtin.create_patient_tool.SessionLocal")
    def test_create_patient_returns_id(self, mock_session_cls):
        """Should return the patient ID in the response."""
        mock_db = MagicMock()
        mock_session_cls.return_value.__enter__ = MagicMock(return_value=mock_db)
        mock_session_cls.return_value.__exit__ = MagicMock(return_value=False)
        mock_db.add.side_effect = lambda p: setattr(p, 'id', 99)

        result = create_patient(name="James Okafor", dob="1975-11-08", gender="male")
        assert "99" in result
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /Users/kien.ha/Code/medical_agent && python -m pytest tests/unit/test_create_patient_tool.py -v`
Expected: FAIL — `ModuleNotFoundError`

- [ ] **Step 3: Implement create_patient tool**

```python
# src/tools/builtin/create_patient_tool.py
"""Built-in tool for creating new patient records.

Called by the Reception agent when no existing patient is found.
Self-registers at import time.
"""
import logging

from src.models import SessionLocal
from src.models.patient import Patient
from src.tools.registry import ToolRegistry

logger = logging.getLogger(__name__)


def create_patient(name: str, dob: str, gender: str) -> str:
    """Create a new patient record in the system.

    Call this after find_patient returns no matches and you have
    collected the patient's basic information.

    Args:
        name: Patient's full name
        dob: Date of birth (format: YYYY-MM-DD)
        gender: Patient's gender (e.g., 'male', 'female', 'other')

    Returns:
        Confirmation message with the new patient's ID
    """
    if not name or not name.strip():
        return "Error: Patient name is required."
    if not dob or not dob.strip():
        return "Error: Date of birth is required."
    if not gender or not gender.strip():
        return "Error: Gender is required."

    with SessionLocal() as db:
        patient = Patient(
            name=name.strip(),
            dob=dob.strip(),
            gender=gender.strip().lower(),
        )
        db.add(patient)
        db.commit()
        db.refresh(patient)

        logger.info("Created new patient: %s (ID: %d)", patient.name, patient.id)

        return (
            f"Patient created successfully.\n"
            f"- ID: {patient.id}\n"
            f"- Name: {patient.name}\n"
            f"- DOB: {patient.dob}\n"
            f"- Gender: {patient.gender}\n"
            f"Use this patient_id ({patient.id}) when creating a visit."
        )


_registry = ToolRegistry()
_registry.register(
    create_patient,
    scope="assignable",
    symbol="create_patient",
    allow_overwrite=True,
)
```

- [ ] **Step 4: Register in __init__.py**

Add to `src/tools/builtin/__init__.py`:
- Import: `from . import create_patient_tool`
- Function import: `from .create_patient_tool import create_patient`
- Add `"create_patient"` to `__all__`

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd /Users/kien.ha/Code/medical_agent && python -m pytest tests/unit/test_create_patient_tool.py -v`
Expected: 3 tests PASS

- [ ] **Step 6: Commit**

```bash
git add src/tools/builtin/create_patient_tool.py tests/unit/test_create_patient_tool.py src/tools/builtin/__init__.py
git commit -m "feat: add create_patient agent tool for autonomous patient registration"
```

---

## Task 3: Agent Tool — create_visit

**Files:**
- Create: `src/tools/builtin/create_visit_tool.py`
- Modify: `src/tools/builtin/__init__.py`

This tool allows the reception agent to create a visit for a patient after collecting their info. It calls the same logic as `POST /api/visits` but as a synchronous tool the agent can invoke during conversation.

- [ ] **Step 1: Implement create_visit tool**

```python
# src/tools/builtin/create_visit_tool.py
"""Built-in tool for creating a new visit record.

Called by the Reception agent after identifying or creating a patient.
Creates a Visit in INTAKE status with a linked ChatSession.
Self-registers at import time.
"""
import logging
from datetime import date

from sqlalchemy import select
from src.models import SessionLocal
from src.models.visit import Visit, VisitStatus
from src.models.patient import Patient
from src.models.chat import ChatSession
from src.models.agent import SubAgent
from src.tools.registry import ToolRegistry

logger = logging.getLogger(__name__)


def create_visit(patient_id: int) -> str:
    """Create a new visit for a patient and begin the intake process.

    Call this after you have identified or created the patient record.
    This creates a visit in INTAKE status. After collecting symptoms,
    call complete_triage to finalize the routing.

    Args:
        patient_id: The patient's ID (from find_patient or create_patient)

    Returns:
        Confirmation with visit ID and instructions
    """
    with SessionLocal() as db:
        # Validate patient exists
        patient = db.execute(
            select(Patient).where(Patient.id == patient_id)
        ).scalar_one_or_none()
        if not patient:
            return f"Error: Patient with id={patient_id} not found."

        # Check for duplicate active intake
        existing = db.execute(
            select(Visit).where(
                Visit.patient_id == patient_id,
                Visit.status == VisitStatus.INTAKE.value,
            )
        ).scalar_one_or_none()
        if existing:
            return (
                f"Patient already has an active intake visit: {existing.visit_id} (ID: {existing.id}). "
                f"Continue the intake with this visit."
            )

        # Find reception agent
        reception_agent = db.execute(
            select(SubAgent).where(SubAgent.role == "reception_triage")
        ).scalar_one_or_none()

        # Generate visit ID
        today = date.today()
        prefix = f"VIS-{today.strftime('%Y%m%d')}-"
        result = db.execute(
            select(Visit.visit_id).where(Visit.visit_id.like(f"{prefix}%"))
            .order_by(Visit.visit_id.desc()).limit(1)
        )
        last_id = result.scalar_one_or_none()
        next_num = int(last_id.split("-")[-1]) + 1 if last_id else 1
        visit_id = f"{prefix}{next_num:03d}"

        # Create chat session
        session = ChatSession(
            title=f"Intake - {visit_id}",
            agent_id=reception_agent.id if reception_agent else None,
        )
        db.add(session)
        db.flush()

        # Create visit
        visit = Visit(
            visit_id=visit_id,
            patient_id=patient_id,
            status=VisitStatus.INTAKE.value,
            intake_session_id=session.id,
        )
        db.add(visit)
        db.commit()
        db.refresh(visit)

        logger.info("Created visit %s for patient %s", visit.visit_id, patient.name)

        return (
            f"Visit created successfully.\n"
            f"- Visit ID: {visit.visit_id}\n"
            f"- Visit DB ID: {visit.id}\n"
            f"- Patient: {patient.name}\n"
            f"- Status: intake\n"
            f"Now collect the patient's symptoms, then call complete_triage "
            f"with id={visit.id} to finalize routing."
        )


_registry = ToolRegistry()
_registry.register(
    create_visit,
    scope="assignable",
    symbol="create_visit",
    allow_overwrite=True,
)
```

- [ ] **Step 2: Register in __init__.py**

Add to `src/tools/builtin/__init__.py`:
- Import: `from . import create_visit_tool`
- Function import: `from .create_visit_tool import create_visit`
- Add `"create_visit"` to `__all__`

- [ ] **Step 3: Verify tool loads**

Run: `cd /Users/kien.ha/Code/medical_agent && python -c "from src.tools.builtin import create_visit; print('OK')"`
Expected: `OK`

- [ ] **Step 4: Commit**

```bash
git add src/tools/builtin/create_visit_tool.py src/tools/builtin/__init__.py
git commit -m "feat: add create_visit agent tool for autonomous visit creation"
```

---

## Task 4: Enhance Visits API — multi-status filter, patient_name, check-in, complete

**Files:**
- Modify: `src/api/models.py:275-306`
- Modify: `src/api/routers/visits.py`
- Create: `tests/unit/test_visit_endpoints.py`

- [ ] **Step 1: Write tests for the new/modified endpoints**

```python
# tests/unit/test_visit_endpoints.py
"""Tests for visit API endpoint changes."""
import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from unittest.mock import AsyncMock, patch

from src.api.app import app
from src.models import get_db


@pytest_asyncio.fixture
async def client(db_session):
    """Create test client with DB override."""
    async def override_get_db():
        yield db_session
    app.dependency_overrides[get_db] = override_get_db
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
    app.dependency_overrides.clear()


class TestListVisitsFiltering:
    """Test enhanced list visits endpoint."""

    @pytest.mark.asyncio
    async def test_exclude_status_filters_completed(self, client, db_session):
        """GET /api/visits?exclude_status=completed should omit completed visits."""
        # Create test data via db_session
        from src.models.visit import Visit, VisitStatus
        from src.models.patient import Patient

        patient = Patient(name="Test Patient", dob="2000-01-01", gender="other")
        db_session.add(patient)
        await db_session.flush()

        active_visit = Visit(
            visit_id="VIS-20260324-001", patient_id=patient.id,
            status=VisitStatus.INTAKE.value
        )
        completed_visit = Visit(
            visit_id="VIS-20260324-002", patient_id=patient.id,
            status=VisitStatus.COMPLETED.value
        )
        db_session.add_all([active_visit, completed_visit])
        await db_session.commit()

        response = await client.get("/api/visits?exclude_status=completed")
        assert response.status_code == 200
        visits = response.json()
        statuses = [v["status"] for v in visits]
        assert "completed" not in statuses

    @pytest.mark.asyncio
    async def test_list_visits_includes_patient_name(self, client, db_session):
        """GET /api/visits should include patient_name in response."""
        from src.models.visit import Visit, VisitStatus
        from src.models.patient import Patient

        patient = Patient(name="Clara Nguyen", dob="1990-06-15", gender="female")
        db_session.add(patient)
        await db_session.flush()

        visit = Visit(
            visit_id="VIS-20260324-003", patient_id=patient.id,
            status=VisitStatus.INTAKE.value
        )
        db_session.add(visit)
        await db_session.commit()

        response = await client.get("/api/visits")
        assert response.status_code == 200
        visits = response.json()
        assert len(visits) >= 1
        assert "patient_name" in visits[0]
        assert visits[0]["patient_name"] == "Clara Nguyen"


class TestVisitCheckIn:
    """Test check-in endpoint."""

    @pytest.mark.asyncio
    async def test_check_in_from_routed(self, client, db_session):
        """PATCH /api/visits/{id}/check-in should transition routed → in_department."""
        from src.models.visit import Visit, VisitStatus
        from src.models.patient import Patient

        patient = Patient(name="Test", dob="2000-01-01", gender="other")
        db_session.add(patient)
        await db_session.flush()

        visit = Visit(
            visit_id="VIS-20260324-004", patient_id=patient.id,
            status=VisitStatus.ROUTED.value,
            routing_decision=["cardiology"]
        )
        db_session.add(visit)
        await db_session.commit()

        response = await client.patch(f"/api/visits/{visit.id}/check-in")
        assert response.status_code == 200
        assert response.json()["status"] == "in_department"

    @pytest.mark.asyncio
    async def test_check_in_rejects_wrong_status(self, client, db_session):
        """PATCH /api/visits/{id}/check-in should reject non-routed visits."""
        from src.models.visit import Visit, VisitStatus
        from src.models.patient import Patient

        patient = Patient(name="Test", dob="2000-01-01", gender="other")
        db_session.add(patient)
        await db_session.flush()

        visit = Visit(
            visit_id="VIS-20260324-005", patient_id=patient.id,
            status=VisitStatus.INTAKE.value
        )
        db_session.add(visit)
        await db_session.commit()

        response = await client.patch(f"/api/visits/{visit.id}/check-in")
        assert response.status_code == 400


class TestVisitComplete:
    """Test complete endpoint."""

    @pytest.mark.asyncio
    async def test_complete_from_in_department(self, client, db_session):
        """PATCH /api/visits/{id}/complete should transition in_department → completed."""
        from src.models.visit import Visit, VisitStatus
        from src.models.patient import Patient

        patient = Patient(name="Test", dob="2000-01-01", gender="other")
        db_session.add(patient)
        await db_session.flush()

        visit = Visit(
            visit_id="VIS-20260324-006", patient_id=patient.id,
            status=VisitStatus.IN_DEPARTMENT.value
        )
        db_session.add(visit)
        await db_session.commit()

        response = await client.patch(f"/api/visits/{visit.id}/complete")
        assert response.status_code == 200
        assert response.json()["status"] == "completed"
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /Users/kien.ha/Code/medical_agent && python -m pytest tests/unit/test_visit_endpoints.py -v`
Expected: FAIL — missing endpoints and response fields

- [ ] **Step 3: Add VisitListResponse to API models**

In `src/api/models.py`, after line 299 (end of `VisitResponse`), add:

```python
class VisitListResponse(VisitResponse):
    """Visit response for list view — includes patient_name."""
    patient_name: str = "Unknown"
```

- [ ] **Step 4: Update list_visits endpoint with exclude_status and patient_name**

In `src/api/routers/visits.py`, modify the `list_visits` function:

```python
@router.get("/api/visits", response_model=list[VisitListResponse])
async def list_visits(
    status: str | None = None,
    exclude_status: str | None = None,
    patient_id: int | None = None,
    limit: int = 50,
    offset: int = 0,
    db: AsyncSession = Depends(get_db),
):
    query = select(Visit, Patient.name).join(Patient, Visit.patient_id == Patient.id).order_by(Visit.created_at.desc())
    if status:
        query = query.where(Visit.status == status)
    if exclude_status:
        query = query.where(Visit.status != exclude_status)
    if patient_id:
        query = query.where(Visit.patient_id == patient_id)
    query = query.limit(limit).offset(offset)
    result = await db.execute(query)
    rows = result.all()
    return [
        VisitListResponse(
            **_visit_to_response(visit).model_dump(),
            patient_name=patient_name,
        )
        for visit, patient_name in rows
    ]
```

Update imports at top of `visits.py`:
```python
from ..models import VisitCreate, VisitResponse, VisitListResponse, VisitDetailResponse, VisitRouteUpdate
```

- [ ] **Step 5: Add check-in endpoint**

Append to `src/api/routers/visits.py`:

```python
@router.patch("/api/visits/{visit_id}/check-in", response_model=VisitResponse)
async def check_in_visit(visit_id: int, db: AsyncSession = Depends(get_db)):
    """Transition a routed visit to in_department status."""
    result = await db.execute(select(Visit).where(Visit.id == visit_id))
    visit = result.scalar_one_or_none()
    if not visit:
        raise HTTPException(status_code=404, detail="Visit not found")
    if visit.status != VisitStatus.ROUTED.value:
        raise HTTPException(status_code=400, detail=f"Visit cannot be checked in from status '{visit.status}'. Must be 'routed'.")
    visit.status = VisitStatus.IN_DEPARTMENT.value
    await db.commit()
    await db.refresh(visit)
    return _visit_to_response(visit)
```

- [ ] **Step 6: Add complete endpoint**

Append to `src/api/routers/visits.py`:

```python
@router.patch("/api/visits/{visit_id}/complete", response_model=VisitResponse)
async def complete_visit(visit_id: int, db: AsyncSession = Depends(get_db)):
    """Transition an in-department visit to completed status."""
    result = await db.execute(select(Visit).where(Visit.id == visit_id))
    visit = result.scalar_one_or_none()
    if not visit:
        raise HTTPException(status_code=404, detail="Visit not found")
    if visit.status != VisitStatus.IN_DEPARTMENT.value:
        raise HTTPException(status_code=400, detail=f"Visit cannot be completed from status '{visit.status}'. Must be 'in_department'.")
    visit.status = VisitStatus.COMPLETED.value
    await db.commit()
    await db.refresh(visit)
    return _visit_to_response(visit)
```

- [ ] **Step 7: Run tests to verify they pass**

Run: `cd /Users/kien.ha/Code/medical_agent && python -m pytest tests/unit/test_visit_endpoints.py -v`
Expected: All tests PASS

- [ ] **Step 8: Commit**

```bash
git add src/api/models.py src/api/routers/visits.py tests/unit/test_visit_endpoints.py
git commit -m "feat: enhance visits API with multi-status filter, patient_name, check-in, and complete endpoints"
```

---

## Task 5: Frontend — Pipeline Constants and API Functions

**Files:**
- Create: `web/components/pipeline/pipeline-constants.ts`
- Modify: `web/lib/api.ts`

- [ ] **Step 1: Create pipeline constants**

```typescript
// web/components/pipeline/pipeline-constants.ts

export type VisitStatus =
  | "intake"
  | "triaged"
  | "auto_routed"
  | "pending_review"
  | "routed"
  | "in_department"
  | "completed";

export interface PipelineColumn {
  id: string;
  title: string;
  statuses: VisitStatus[];
  color: string;
  dotColor: string;
}

export const PIPELINE_COLUMNS: PipelineColumn[] = [
  {
    id: "intake",
    title: "Intake",
    statuses: ["intake", "triaged"],
    color: "#00d9ff",
    dotColor: "bg-cyan-400",
  },
  {
    id: "routing",
    title: "Routing",
    statuses: ["auto_routed"],
    color: "#a78bfa",
    dotColor: "bg-violet-400",
  },
  {
    id: "needs-review",
    title: "Needs Review",
    statuses: ["pending_review"],
    color: "#f59e0b",
    dotColor: "bg-amber-400",
  },
  {
    id: "routed",
    title: "Routed",
    statuses: ["routed"],
    color: "#10b981",
    dotColor: "bg-emerald-400",
  },
  {
    id: "in-department",
    title: "In Department",
    statuses: ["in_department"],
    color: "#6366f1",
    dotColor: "bg-indigo-400",
  },
];

export const STATUS_COLUMN_MAP: Record<string, string> = {};
for (const col of PIPELINE_COLUMNS) {
  for (const status of col.statuses) {
    STATUS_COLUMN_MAP[status] = col.id;
  }
}

export function getColumnForStatus(status: string): PipelineColumn | undefined {
  const colId = STATUS_COLUMN_MAP[status];
  return PIPELINE_COLUMNS.find((c) => c.id === colId);
}

export function formatTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
```

- [ ] **Step 2: Add API functions to web/lib/api.ts**

Add these functions and update the `Visit` interface:

Add a `VisitListItem` type (do NOT modify the existing `Visit` interface — other endpoints don't return `patient_name`):
```typescript
export interface VisitListItem extends Visit {
  patient_name: string;
}
```

Add new API functions after the existing visit functions:
```typescript
export async function listActiveVisits(): Promise<VisitListItem[]> {
  const response = await fetch(
    `${API_BASE_URL}/visits?exclude_status=completed`
  );
  if (!response.ok) throw new Error("Failed to fetch active visits");
  return response.json();
}

export async function checkInVisit(id: number): Promise<Visit> {
  const response = await fetch(`${API_BASE_URL}/visits/${id}/check-in`, {
    method: "PATCH",
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to check in visit");
  }
  return response.json();
}

export async function completeVisit(id: number): Promise<Visit> {
  const response = await fetch(`${API_BASE_URL}/visits/${id}/complete`, {
    method: "PATCH",
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to complete visit");
  }
  return response.json();
}
```

- [ ] **Step 3: Commit**

```bash
git add web/components/pipeline/pipeline-constants.ts web/lib/api.ts
git commit -m "feat: add pipeline constants and API functions for visit pipeline"
```

---

## Task 6: Frontend — Visit Card Component

**Files:**
- Create: `web/components/pipeline/visit-card.tsx`

- [ ] **Step 1: Create the visit card component**

```tsx
// web/components/pipeline/visit-card.tsx
"use client";

import { cn } from "@/lib/utils";
import { VisitListItem } from "@/lib/api";
import { formatTimeAgo, getColumnForStatus } from "./pipeline-constants";

interface VisitCardProps {
  visit: VisitListItem;
  isSelected: boolean;
  onClick: () => void;
}

export function VisitCard({ visit, isSelected, onClick }: VisitCardProps) {
  const column = getColumnForStatus(visit.status);

  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full text-left rounded-lg p-3 border transition-all",
        "bg-card/40 hover:bg-card/70",
        isSelected
          ? "border-cyan-500/60 bg-card/80 shadow-sm shadow-cyan-500/10"
          : "border-border/40 hover:border-border/70"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1">
            <div
              className="w-2 h-2 rounded-full shrink-0"
              style={{ backgroundColor: column?.color }}
            />
            <span className="text-sm font-medium text-foreground truncate">
              {visit.patient_name}
            </span>
          </div>
          <p className="text-xs text-muted-foreground font-mono">
            {visit.visit_id}
          </p>
        </div>
        <span className="text-xs text-muted-foreground shrink-0">
          {formatTimeAgo(visit.created_at)}
        </span>
      </div>
      {visit.chief_complaint && (
        <p className="text-xs text-muted-foreground mt-2 line-clamp-2">
          {visit.chief_complaint}
        </p>
      )}
    </button>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `cd /Users/kien.ha/Code/medical_agent/web && npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors related to visit-card.tsx

- [ ] **Step 3: Commit**

```bash
git add web/components/pipeline/visit-card.tsx
git commit -m "feat: add visit card component for pipeline kanban"
```

---

## Task 7: Frontend — Detail Panel Sub-components

**Files:**
- Create: `web/components/pipeline/intake-detail.tsx`
- Create: `web/components/pipeline/review-detail.tsx`
- Create: `web/components/pipeline/routed-detail.tsx`
- Create: `web/components/pipeline/department-detail.tsx`
- Create: `web/components/pipeline/detail-panel.tsx`

- [ ] **Step 1: Create intake-detail.tsx**

```tsx
// web/components/pipeline/intake-detail.tsx
"use client";

import { useEffect, useState, useRef } from "react";
import { VisitDetail } from "@/lib/api";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";

interface IntakeDetailProps {
  visit: VisitDetail;
}

interface ChatMsg {
  id: number;
  role: string;
  content: string;
}

export function IntakeDetail({ visit }: IntakeDetailProps) {
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [loading, setLoading] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!visit.intake_session_id) {
      setLoading(false);
      return;
    }
    const fetchMessages = async () => {
      try {
        const res = await fetch(
          `/api/chat/sessions/${visit.intake_session_id}/messages`
        );
        if (res.ok) {
          const data = await res.json();
          setMessages(data);
        }
      } catch {
        // silently fail
      } finally {
        setLoading(false);
      }
    };
    fetchMessages();
    const interval = setInterval(fetchMessages, 5000);
    return () => clearInterval(interval);
  }, [visit.intake_session_id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <div className="flex flex-col gap-4 h-full">
      <div>
        <div className="flex items-center gap-2 mb-2">
          <Badge variant="outline" className="border-cyan-500/40 text-cyan-500">
            Intake in Progress
          </Badge>
        </div>
        <p className="text-sm text-foreground">{visit.patient_name}</p>
        <p className="text-xs text-muted-foreground">
          {visit.patient_dob} · {visit.patient_gender}
        </p>
        {visit.chief_complaint && (
          <p className="text-sm text-muted-foreground mt-2">
            Chief complaint: {visit.chief_complaint}
          </p>
        )}
      </div>

      <div className="flex-1 min-h-0">
        <p className="text-xs text-muted-foreground font-mono mb-2 uppercase tracking-wider">
          Intake Chat (read-only)
        </p>
        <ScrollArea className="h-full rounded-lg border border-border/40 bg-background/40 p-3">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
            </div>
          ) : messages.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-8">
              Waiting for intake conversation...
            </p>
          ) : (
            <div className="space-y-3">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`text-sm ${
                    msg.role === "user"
                      ? "text-foreground"
                      : "text-muted-foreground"
                  }`}
                >
                  <span className="text-xs font-mono text-muted-foreground/60 mr-2">
                    {msg.role === "user" ? "Patient:" : "Agent:"}
                  </span>
                  {msg.content}
                </div>
              ))}
              <div ref={bottomRef} />
            </div>
          )}
        </ScrollArea>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create review-detail.tsx**

```tsx
// web/components/pipeline/review-detail.tsx
"use client";

import { useState } from "react";
import { VisitDetail, routeVisit } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CheckCircle, Edit3 } from "lucide-react";

const DEPARTMENTS = [
  "Cardiology", "Pulmonology", "Neurology", "Gastroenterology",
  "Orthopedics", "Dermatology", "Psychiatry", "Oncology",
  "Nephrology", "Endocrinology", "Emergency", "General Medicine",
  "Ophthalmology", "ENT",
];

interface ReviewDetailProps {
  visit: VisitDetail;
  onVisitUpdated: () => void;
}

export function ReviewDetail({ visit, onVisitUpdated }: ReviewDetailProps) {
  const [selectedDepts, setSelectedDepts] = useState<string[]>(
    visit.routing_suggestion || []
  );
  const [reviewedBy, setReviewedBy] = useState("");
  const [isRouting, setIsRouting] = useState(false);
  const [showDeptSelector, setShowDeptSelector] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleApprove = async () => {
    if (!reviewedBy.trim()) {
      setError("Please enter your name");
      return;
    }
    setIsRouting(true);
    setError(null);
    try {
      await routeVisit(visit.id, selectedDepts, reviewedBy.trim());
      onVisitUpdated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to route visit");
    } finally {
      setIsRouting(false);
    }
  };

  const toggleDept = (dept: string) => {
    setSelectedDepts((prev) =>
      prev.includes(dept) ? prev.filter((d) => d !== dept) : [...prev, dept]
    );
  };

  const isPendingReview = visit.status === "pending_review";

  return (
    <div className="flex flex-col gap-4 h-full">
      <div>
        <div className="flex items-center gap-2 mb-2">
          <Badge
            variant="outline"
            className={
              isPendingReview
                ? "border-amber-500/40 text-amber-500"
                : "border-violet-500/40 text-violet-500"
            }
          >
            {isPendingReview ? "Needs Review" : "Auto-Routed"}
          </Badge>
          {visit.confidence !== null && (
            <span className="text-xs text-muted-foreground">
              Confidence: {(visit.confidence * 100).toFixed(0)}%
            </span>
          )}
        </div>
        <p className="text-sm text-foreground">{visit.patient_name}</p>
        <p className="text-xs text-muted-foreground">
          {visit.patient_dob} · {visit.patient_gender}
        </p>
      </div>

      {visit.chief_complaint && (
        <div>
          <p className="text-xs text-muted-foreground font-mono mb-1 uppercase tracking-wider">
            Chief Complaint
          </p>
          <p className="text-sm text-foreground">{visit.chief_complaint}</p>
        </div>
      )}

      {visit.intake_notes && (
        <div className="flex-1 min-h-0">
          <p className="text-xs text-muted-foreground font-mono mb-1 uppercase tracking-wider">
            Intake Notes
          </p>
          <ScrollArea className="max-h-40 rounded-lg border border-border/40 bg-background/40 p-3">
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">
              {visit.intake_notes}
            </p>
          </ScrollArea>
        </div>
      )}

      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs text-muted-foreground font-mono uppercase tracking-wider">
            Routing
          </p>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-xs"
            onClick={() => setShowDeptSelector(!showDeptSelector)}
          >
            <Edit3 className="w-3 h-3 mr-1" />
            Change
          </Button>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {selectedDepts.map((dept) => (
            <Badge key={dept} variant="secondary" className="text-xs">
              {dept}
            </Badge>
          ))}
        </div>
        {showDeptSelector && (
          <div className="flex flex-wrap gap-1.5 mt-2 p-2 rounded-lg border border-border/40 bg-background/40">
            {DEPARTMENTS.map((dept) => (
              <button
                key={dept}
                onClick={() => toggleDept(dept)}
                className={`text-xs px-2 py-1 rounded-md border transition-colors ${
                  selectedDepts.includes(dept)
                    ? "border-cyan-500/60 bg-cyan-500/10 text-cyan-400"
                    : "border-border/40 text-muted-foreground hover:border-border"
                }`}
              >
                {dept}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="border-t border-border/40 pt-3 mt-auto">
        <Input
          placeholder="Reviewed by (your name)"
          value={reviewedBy}
          onChange={(e) => setReviewedBy(e.target.value)}
          className="mb-2 bg-card/50 text-sm"
        />
        {error && <p className="text-xs text-red-400 mb-2">{error}</p>}
        <Button
          onClick={handleApprove}
          disabled={isRouting || selectedDepts.length === 0}
          className="w-full bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-600 hover:to-teal-600 text-white"
        >
          <CheckCircle className="w-4 h-4 mr-2" />
          {isRouting ? "Routing..." : "Approve Route"}
        </Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create routed-detail.tsx**

```tsx
// web/components/pipeline/routed-detail.tsx
"use client";

import { useState } from "react";
import { VisitDetail, checkInVisit } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LogIn } from "lucide-react";

interface RoutedDetailProps {
  visit: VisitDetail;
  onVisitUpdated: () => void;
}

export function RoutedDetail({ visit, onVisitUpdated }: RoutedDetailProps) {
  const [isChecking, setIsChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCheckIn = async () => {
    setIsChecking(true);
    setError(null);
    try {
      await checkInVisit(visit.id);
      onVisitUpdated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to check in");
    } finally {
      setIsChecking(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 h-full">
      <div>
        <Badge variant="outline" className="border-emerald-500/40 text-emerald-500 mb-2">
          Routed
        </Badge>
        <p className="text-sm text-foreground">{visit.patient_name}</p>
        <p className="text-xs text-muted-foreground">
          {visit.patient_dob} · {visit.patient_gender}
        </p>
      </div>

      {visit.chief_complaint && (
        <div>
          <p className="text-xs text-muted-foreground font-mono mb-1 uppercase tracking-wider">
            Chief Complaint
          </p>
          <p className="text-sm text-foreground">{visit.chief_complaint}</p>
        </div>
      )}

      <div>
        <p className="text-xs text-muted-foreground font-mono mb-1 uppercase tracking-wider">
          Routing Decision
        </p>
        <div className="flex flex-wrap gap-1.5">
          {visit.routing_decision?.map((dept) => (
            <Badge key={dept} variant="secondary" className="text-xs">
              {dept}
            </Badge>
          ))}
        </div>
        {visit.reviewed_by && (
          <p className="text-xs text-muted-foreground mt-2">
            Reviewed by: {visit.reviewed_by}
          </p>
        )}
      </div>

      <div className="border-t border-border/40 pt-3 mt-auto">
        {error && <p className="text-xs text-red-400 mb-2">{error}</p>}
        <Button
          onClick={handleCheckIn}
          disabled={isChecking}
          className="w-full bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-600 hover:to-teal-600 text-white"
        >
          <LogIn className="w-4 h-4 mr-2" />
          {isChecking ? "Checking in..." : "Check In to Department"}
        </Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Create department-detail.tsx**

```tsx
// web/components/pipeline/department-detail.tsx
"use client";

import { useState } from "react";
import { VisitDetail, completeVisit } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2 } from "lucide-react";

interface DepartmentDetailProps {
  visit: VisitDetail;
  onVisitUpdated: () => void;
}

export function DepartmentDetail({ visit, onVisitUpdated }: DepartmentDetailProps) {
  const [isCompleting, setIsCompleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleComplete = async () => {
    setIsCompleting(true);
    setError(null);
    try {
      await completeVisit(visit.id);
      onVisitUpdated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to complete visit");
    } finally {
      setIsCompleting(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 h-full">
      <div>
        <Badge variant="outline" className="border-indigo-500/40 text-indigo-500 mb-2">
          In Department
        </Badge>
        <p className="text-sm text-foreground">{visit.patient_name}</p>
        <p className="text-xs text-muted-foreground">
          {visit.patient_dob} · {visit.patient_gender}
        </p>
      </div>

      {visit.chief_complaint && (
        <div>
          <p className="text-xs text-muted-foreground font-mono mb-1 uppercase tracking-wider">
            Chief Complaint
          </p>
          <p className="text-sm text-foreground">{visit.chief_complaint}</p>
        </div>
      )}

      <div>
        <p className="text-xs text-muted-foreground font-mono mb-1 uppercase tracking-wider">
          Department
        </p>
        <div className="flex flex-wrap gap-1.5">
          {visit.routing_decision?.map((dept) => (
            <Badge key={dept} variant="secondary" className="text-xs">
              {dept}
            </Badge>
          ))}
        </div>
        {visit.reviewed_by && (
          <p className="text-xs text-muted-foreground mt-2">
            Reviewed by: {visit.reviewed_by}
          </p>
        )}
      </div>

      <div className="border-t border-border/40 pt-3 mt-auto">
        {error && <p className="text-xs text-red-400 mb-2">{error}</p>}
        <Button
          onClick={handleComplete}
          disabled={isCompleting}
          className="w-full bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-600 hover:to-teal-600 text-white"
        >
          <CheckCircle2 className="w-4 h-4 mr-2" />
          {isCompleting ? "Completing..." : "Complete Visit"}
        </Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Create detail-panel.tsx (orchestrator)**

```tsx
// web/components/pipeline/detail-panel.tsx
"use client";

import { useEffect, useState } from "react";
import { VisitListItem, VisitDetail, getVisit } from "@/lib/api";
import { IntakeDetail } from "./intake-detail";
import { ReviewDetail } from "./review-detail";
import { RoutedDetail } from "./routed-detail";
import { DepartmentDetail } from "./department-detail";
import { Loader2, MousePointerClick } from "lucide-react";

interface DetailPanelProps {
  selectedVisit: VisitListItem | null;
  onVisitUpdated: () => void;
}

export function DetailPanel({ selectedVisit, onVisitUpdated }: DetailPanelProps) {
  const [visitDetail, setVisitDetail] = useState<VisitDetail | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!selectedVisit) {
      setVisitDetail(null);
      return;
    }
    setLoading(true);
    getVisit(selectedVisit.id)
      .then(setVisitDetail)
      .catch(() => setVisitDetail(null))
      .finally(() => setLoading(false));
  }, [selectedVisit?.id, selectedVisit?.status]);

  if (!selectedVisit) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-3">
        <MousePointerClick className="w-8 h-8 opacity-40" />
        <p className="text-sm">Select a visit to view details</p>
      </div>
    );
  }

  if (loading || !visitDetail) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const status = visitDetail.status;

  if (status === "intake" || status === "triaged") {
    return <IntakeDetail visit={visitDetail} />;
  }

  if (status === "auto_routed" || status === "pending_review") {
    return <ReviewDetail visit={visitDetail} onVisitUpdated={onVisitUpdated} />;
  }

  if (status === "routed") {
    return <RoutedDetail visit={visitDetail} onVisitUpdated={onVisitUpdated} />;
  }

  if (status === "in_department") {
    return <DepartmentDetail visit={visitDetail} onVisitUpdated={onVisitUpdated} />;
  }

  return (
    <div className="flex items-center justify-center h-full text-muted-foreground">
      <p className="text-sm">Unknown visit status: {status}</p>
    </div>
  );
}
```

- [ ] **Step 6: Verify compilation**

Run: `cd /Users/kien.ha/Code/medical_agent/web && npx tsc --noEmit --pretty 2>&1 | head -30`
Expected: No errors in pipeline components

- [ ] **Step 7: Commit**

```bash
git add web/components/pipeline/
git commit -m "feat: add pipeline detail panel components for all visit stages"
```

---

## Task 8: Frontend — Kanban Board Component

**Files:**
- Create: `web/components/pipeline/kanban-board.tsx`

- [ ] **Step 1: Create kanban-board.tsx**

```tsx
// web/components/pipeline/kanban-board.tsx
"use client";

import { VisitListItem } from "@/lib/api";
import { PIPELINE_COLUMNS } from "./pipeline-constants";
import { VisitCard } from "./visit-card";
import { ScrollArea } from "@/components/ui/scroll-area";

interface KanbanBoardProps {
  visits: VisitListItem[];
  selectedVisitId: number | null;
  onSelectVisit: (visit: VisitListItem) => void;
}

export function KanbanBoard({
  visits,
  selectedVisitId,
  onSelectVisit,
}: KanbanBoardProps) {
  const getVisitsForColumn = (statuses: string[]) =>
    visits.filter((v) => statuses.includes(v.status));

  return (
    <div className="flex gap-3 h-full min-w-0">
      {PIPELINE_COLUMNS.map((column) => {
        const columnVisits = getVisitsForColumn(column.statuses);
        return (
          <div
            key={column.id}
            className="flex-1 min-w-0 flex flex-col rounded-xl bg-card/20 border border-border/30"
          >
            {/* Column Header */}
            <div
              className="px-3 py-2.5 border-b border-border/30 flex items-center justify-between shrink-0"
              style={{ borderTopColor: column.color, borderTopWidth: 3, borderTopLeftRadius: 12, borderTopRightRadius: 12 }}
            >
              <span
                className="text-xs font-semibold tracking-wider uppercase"
                style={{ color: column.color }}
              >
                {column.title}
              </span>
              <span
                className="text-xs px-1.5 py-0.5 rounded-md"
                style={{
                  backgroundColor: `${column.color}15`,
                  color: column.color,
                }}
              >
                {columnVisits.length}
              </span>
            </div>

            {/* Column Body */}
            <ScrollArea className="flex-1 min-h-0">
              <div className="p-2 space-y-2">
                {columnVisits.length === 0 ? (
                  <p className="text-xs text-muted-foreground/50 text-center py-6">
                    No visits
                  </p>
                ) : (
                  columnVisits.map((visit) => (
                    <VisitCard
                      key={visit.id}
                      visit={visit}
                      isSelected={visit.id === selectedVisitId}
                      onClick={() => onSelectVisit(visit)}
                    />
                  ))
                )}
              </div>
            </ScrollArea>
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Verify compilation**

Run: `cd /Users/kien.ha/Code/medical_agent/web && npx tsc --noEmit --pretty 2>&1 | head -20`

- [ ] **Step 3: Commit**

```bash
git add web/components/pipeline/kanban-board.tsx
git commit -m "feat: add kanban board component with column layout"
```

---

## Task 9: Frontend — Pipeline Page

**Files:**
- Create: `web/app/(dashboard)/pipeline/page.tsx`

- [ ] **Step 1: Create the pipeline page**

```tsx
// web/app/(dashboard)/pipeline/page.tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import { VisitListItem, listActiveVisits, listVisits } from "@/lib/api";
import { KanbanBoard } from "@/components/pipeline/kanban-board";
import { DetailPanel } from "@/components/pipeline/detail-panel";
import { Workflow } from "lucide-react";

export default function PipelinePage() {
  const [visits, setVisits] = useState<VisitListItem[]>([]);
  const [selectedVisit, setSelectedVisit] = useState<VisitListItem | null>(null);
  const [showCompleted, setShowCompleted] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchVisits = useCallback(async () => {
    try {
      const data = showCompleted
        ? await listVisits()
        : await listActiveVisits();
      setVisits(data);

      // Update selected visit if it still exists
      if (selectedVisit) {
        const updated = data.find((v) => v.id === selectedVisit.id);
        if (updated) {
          setSelectedVisit(updated);
        }
      }
    } catch (err) {
      console.error("Failed to fetch visits:", err);
    } finally {
      setLoading(false);
    }
  }, [showCompleted, selectedVisit?.id]);

  // Initial fetch + polling
  useEffect(() => {
    fetchVisits();
    const interval = setInterval(fetchVisits, 5000);
    return () => clearInterval(interval);
  }, [fetchVisits]);

  const activeCount = visits.filter((v) => v.status !== "completed").length;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border/50 shrink-0">
        <div className="flex items-center gap-3">
          <Workflow className="w-5 h-5 text-cyan-500" />
          <h1 className="text-lg font-semibold text-foreground">
            Visit Pipeline
          </h1>
          <span className="text-sm text-muted-foreground">
            {activeCount} active
          </span>
        </div>
        <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
          <input
            type="checkbox"
            checked={showCompleted}
            onChange={(e) => setShowCompleted(e.target.checked)}
            className="rounded border-border"
          />
          Show completed
        </label>
      </div>

      {/* Main Content */}
      <div className="flex-1 min-h-0 flex">
        {/* Kanban Board */}
        <div className="flex-[2] min-w-0 p-4">
          {loading ? (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              Loading visits...
            </div>
          ) : visits.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-3">
              <Workflow className="w-10 h-10 opacity-30" />
              <p className="text-sm">No active visits</p>
              <p className="text-xs">
                Visits will appear here when patients start conversations.
              </p>
            </div>
          ) : (
            <KanbanBoard
              visits={visits}
              selectedVisitId={selectedVisit?.id ?? null}
              onSelectVisit={setSelectedVisit}
            />
          )}
        </div>

        {/* Detail Panel */}
        <div className="flex-[1.5] min-w-0 border-l border-border/50 p-4">
          <DetailPanel
            selectedVisit={selectedVisit}
            onVisitUpdated={fetchVisits}
          />
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify compilation**

Run: `cd /Users/kien.ha/Code/medical_agent/web && npx tsc --noEmit --pretty 2>&1 | head -20`

- [ ] **Step 3: Commit**

```bash
git add web/app/\(dashboard\)/pipeline/page.tsx
git commit -m "feat: add pipeline page with kanban board and detail panel"
```

---

## Task 10: Sidebar Navigation Update

**Files:**
- Modify: `web/components/sidebar.tsx`

- [ ] **Step 1: Read current sidebar**

Read `web/components/sidebar.tsx` and locate the `navigation` array.

- [ ] **Step 2: Replace Reception + Doctor Queue with Pipeline**

In the navigation array, replace:
```typescript
{
  name: "Reception",
  href: "/reception",
  icon: ClipboardList,
},
{
  name: "Doctor Queue",
  href: "/doctor/queue",
  icon: Stethoscope,
},
```

With:
```typescript
{
  name: "Pipeline",
  href: "/pipeline",
  icon: Workflow,
},
```

Update imports: replace `ClipboardList, Stethoscope` with `Workflow` (from lucide-react). Keep other icons that are still used.

- [ ] **Step 3: Verify compilation and visual check**

Run: `cd /Users/kien.ha/Code/medical_agent/web && npx tsc --noEmit --pretty 2>&1 | head -20`

- [ ] **Step 4: Commit**

```bash
git add web/components/sidebar.tsx
git commit -m "feat: replace Reception + Doctor Queue with Pipeline in sidebar navigation"
```

---

## Task 11: Remove Old Pages and Dead Code

**Files:**
- Remove: `web/app/(dashboard)/reception/page.tsx`
- Remove: `web/app/(dashboard)/doctor/queue/page.tsx`
- Remove: `web/components/reception/patient-selector.tsx`
- Remove: `web/components/reception/visit-info-card.tsx`
- Remove: `web/components/doctor/visit-queue-card.tsx`
- Remove: `web/components/doctor/route-approval-dialog.tsx`
- Remove: `web/components/doctor/intake-viewer-dialog.tsx`

- [ ] **Step 1: Verify no other files import these components**

Run grep for imports of the components being removed to ensure nothing else depends on them.

- [ ] **Step 2: Remove old files**

```bash
rm web/app/\(dashboard\)/reception/page.tsx
rm web/app/\(dashboard\)/doctor/queue/page.tsx
rm web/components/reception/patient-selector.tsx
rm web/components/reception/visit-info-card.tsx
rm web/components/doctor/visit-queue-card.tsx
rm web/components/doctor/route-approval-dialog.tsx
rm web/components/doctor/intake-viewer-dialog.tsx
```

Keep `web/components/reception/intake-chat.tsx` — it may be useful for a future enhanced intake detail panel.

- [ ] **Step 3: Verify compilation**

Run: `cd /Users/kien.ha/Code/medical_agent/web && npx tsc --noEmit --pretty 2>&1 | head -20`
Fix any broken imports.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "refactor: remove old reception and doctor queue pages replaced by pipeline"
```

---

## Task 12: Update Agent System Prompt

**Files:**
- Modify: `scripts/db/seed/seed_full_flow.py` (the reception agent system prompt)

- [ ] **Step 1: Read current system prompt location**

Read `scripts/db/seed/seed_full_flow.py` around line 723-781 to find the `reception_system_prompt`.

- [ ] **Step 2: Update the system prompt**

Replace the existing `reception_system_prompt` with an updated version that instructs the agent to:

1. Greet patient
2. Collect name, DOB, gender
3. Call `find_patient` to check for existing record
4. If not found, call `create_patient`
5. Collect symptoms and chief complaint
6. Reason about routing
7. Call `complete_triage` with routing suggestion and confidence
8. Give closing message

The updated prompt should reference the new tools (`find_patient`, `create_patient`) and the existing `complete_triage` tool.

- [ ] **Step 3: Run seed script to verify it works**

Run: `cd /Users/kien.ha/Code/medical_agent && python scripts/db/seed/seed_full_flow.py --clear`
Expected: Seeds successfully with updated agent prompt

- [ ] **Step 4: Commit**

```bash
git add scripts/db/seed/seed_full_flow.py
git commit -m "feat: update reception agent system prompt for autonomous intake flow"
```

---

## Task 13: End-to-End Verification

- [ ] **Step 1: Run all backend tests**

Run: `cd /Users/kien.ha/Code/medical_agent && python -m pytest tests/ -v`
Expected: All tests PASS

- [ ] **Step 2: Run frontend type check**

Run: `cd /Users/kien.ha/Code/medical_agent/web && npx tsc --noEmit --pretty`
Expected: No type errors

- [ ] **Step 3: Start dev servers and verify pipeline page**

Run backend: `cd /Users/kien.ha/Code/medical_agent && python -m uvicorn src.api.app:app --reload`
Run frontend: `cd /Users/kien.ha/Code/medical_agent/web && npm run dev`

Open `http://localhost:3000/pipeline` and verify:
- Kanban columns render with correct colors and headers
- Visit cards from seed data appear in correct columns
- Clicking a card shows detail panel with stage-appropriate content
- Routing approval works from detail panel
- Check-in and complete transitions work
- "Show completed" toggle works
- Sidebar shows Pipeline link instead of Reception/Doctor Queue

- [ ] **Step 4: Test public chat → pipeline flow**

Open `http://localhost:3000` (public page) and start a conversation. Verify the agent:
- Greets and collects patient info
- Creates patient record (via `create_patient` tool)
- Creates visit (via existing `POST /api/visits` mechanism)
- Completes triage (via `complete_triage` tool)
- Visit appears on pipeline

- [ ] **Step 5: Final commit (if any fixes needed)**

```bash
git add -A
git commit -m "fix: end-to-end verification fixes for visit pipeline"
```
