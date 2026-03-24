# Hospital Operations Canvas Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Kanban pipeline with a living, interactive hospital canvas at `/operations` using @xyflow/react — showing departments as nodes with patient queue tails, animated flow, drag-and-drop transfers, and real-time KPIs.

**Architecture:** Backend-first approach. Create the Department model and seed data, add new API endpoints (departments, transfer, stats), update the Visit model with `current_department` and `queue_position`. Then build the frontend canvas with custom xyflow nodes, patient dots, queue tails, popover cards, dialogs, and KPI bar. Finally, wire up navigation and remove old Kanban components.

**Tech Stack:** Python/FastAPI/SQLAlchemy (backend), React 19/Next.js 16/TypeScript/@xyflow/react 12/Tailwind CSS v4/Radix UI (frontend)

**Spec:** `docs/superpowers/specs/2026-03-25-hospital-operations-canvas-design.md`

---

## File Structure

### Backend (New Files)

| File | Responsibility |
|------|---------------|
| `src/models/department.py` | Department SQLAlchemy model |
| `src/api/routers/departments.py` | Department CRUD + stats endpoints |
| `src/api/routers/hospital.py` | Hospital-level KPI stats endpoint |
| `alembic/versions/xxxx_add_departments.py` | Migration: departments table + visit fields |
| `src/constants/department_seed_data.py` | Seed data with colors, icons, capacities |
| `tests/test_department_model.py` | Department model tests |
| `tests/test_department_api.py` | Department API endpoint tests |
| `tests/test_visit_transfer.py` | Transfer endpoint tests |
| `tests/test_hospital_stats.py` | Hospital stats endpoint tests |

### Backend (Modified Files)

| File | Changes |
|------|---------|
| `src/models/visit.py` | Add `current_department`, `queue_position` fields |
| `src/models/__init__.py` | Export `Department` |
| `src/api/models.py` | Add Department Pydantic schemas, transfer request model |
| `src/api/routers/visits.py` | Update `check_in_visit` and `complete_visit` to set/clear `current_department` + `queue_position`; add transfer endpoint |
| `src/api/server.py` | Register department and hospital routers |

### Frontend (New Files)

| File | Responsibility |
|------|---------------|
| `web/app/(dashboard)/operations/page.tsx` | Operations page (replaces pipeline page) |
| `web/components/operations/hospital-canvas.tsx` | Main xyflow canvas wrapper |
| `web/components/operations/canvas/reception-node.tsx` | ReceptionNode custom xyflow node |
| `web/components/operations/canvas/department-node.tsx` | DepartmentNode custom xyflow node |
| `web/components/operations/canvas/discharge-node.tsx` | DischargeNode custom xyflow node |
| `web/components/operations/canvas/patient-dot.tsx` | Patient dot component with wait-time colors |
| `web/components/operations/canvas/patient-popover.tsx` | Popover card on patient click |
| `web/components/operations/canvas/queue-tail.tsx` | Queue tail layout logic |
| `web/components/operations/canvas/flow-edge.tsx` | Animated Reception → Department edge |
| `web/components/operations/canvas/transfer-edge.tsx` | Transfer animation edge |
| `web/components/operations/dialogs/reception-dialog.tsx` | Reception tabbed dialog |
| `web/components/operations/dialogs/department-dialog.tsx` | Department queue + settings dialog |
| `web/components/operations/kpi-bar.tsx` | Top KPI stats bar |
| `web/components/operations/use-hospital-canvas.ts` | Data fetching + xyflow transform hook |
| `web/components/operations/operations-constants.ts` | Colors, icons, status thresholds |

### Frontend (Modified Files)

| File | Changes |
|------|---------|
| `web/lib/api.ts` | Add department API functions, transfer function, hospital stats function; update Visit interfaces |
| `web/components/sidebar.tsx` | Change Pipeline → Operations nav item |

### Frontend (Removed Files)

| File | Reason |
|------|--------|
| `web/app/(dashboard)/pipeline/page.tsx` | Replaced by operations page |
| `web/components/pipeline/kanban-board.tsx` | Replaced by canvas |
| `web/components/pipeline/kanban-column.tsx` | Replaced by canvas |
| `web/components/pipeline/visit-card.tsx` | Replaced by patient dots |
| `web/components/pipeline/detail-panel.tsx` | Replaced by node dialogs |
| `web/components/pipeline/pipeline-constants.ts` | Moved to operations-constants.ts |

### Frontend (Moved Files)

| From | To | Notes |
|------|----|-------|
| `web/components/pipeline/intake-detail.tsx` | `web/components/operations/dialogs/` | Reused inside reception-dialog |
| `web/components/pipeline/review-detail.tsx` | `web/components/operations/dialogs/` | Reused inside reception-dialog |
| `web/components/pipeline/routed-detail.tsx` | `web/components/operations/dialogs/` | Reused inside reception-dialog |
| `web/components/pipeline/department-detail.tsx` | `web/components/operations/dialogs/` | Adapted for department-dialog |

---

## Task 1: Department Model & Migration

**Files:**
- Create: `src/models/department.py`
- Create: `src/constants/department_seed_data.py`
- Modify: `src/models/__init__.py`
- Modify: `src/models/visit.py:27-59`
- Test: `tests/test_department_model.py`

- [ ] **Step 1: Write failing test for Department model**

```python
# tests/test_department_model.py
import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import AsyncSession

from src.models.department import Department


@pytest_asyncio.fixture
async def sample_department(db_session: AsyncSession) -> Department:
    dept = Department(
        name="cardiology",
        label="Cardiology",
        capacity=4,
        is_open=True,
        color="#10b981",
        icon="Heart",
    )
    db_session.add(dept)
    await db_session.commit()
    await db_session.refresh(dept)
    return dept


@pytest.mark.asyncio
async def test_department_creation(sample_department: Department):
    assert sample_department.id is not None
    assert sample_department.name == "cardiology"
    assert sample_department.label == "Cardiology"
    assert sample_department.capacity == 4
    assert sample_department.is_open is True
    assert sample_department.color == "#10b981"
    assert sample_department.icon == "Heart"


@pytest.mark.asyncio
async def test_department_name_is_unique(db_session: AsyncSession, sample_department: Department):
    duplicate = Department(
        name="cardiology",
        label="Cardiology Duplicate",
        capacity=2,
        is_open=True,
        color="#000",
        icon="Heart",
    )
    db_session.add(duplicate)
    with pytest.raises(Exception):  # IntegrityError
        await db_session.commit()
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/test_department_model.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'src.models.department'`

- [ ] **Step 3: Create Department model**

```python
# src/models/department.py
"""Department model for hospital departments."""
from sqlalchemy import Boolean, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from .base import Base


class Department(Base):
    """Department model — represents a hospital department with capacity tracking."""
    __tablename__ = "departments"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(50), unique=True, index=True)
    label: Mapped[str] = mapped_column(String(100))
    capacity: Mapped[int] = mapped_column(Integer, default=3)
    is_open: Mapped[bool] = mapped_column(Boolean, default=True)
    color: Mapped[str] = mapped_column(String(10), default="#6366f1")
    icon: Mapped[str] = mapped_column(String(50), default="Building2")
```

- [ ] **Step 4: Create department seed data**

```python
# src/constants/department_seed_data.py
"""Seed data for hospital departments with colors, icons, and capacities."""

DEPARTMENT_SEED_DATA = [
    {"name": "emergency", "label": "Emergency", "capacity": 6, "color": "#ef4444", "icon": "Siren"},
    {"name": "cardiology", "label": "Cardiology", "capacity": 4, "color": "#10b981", "icon": "Heart"},
    {"name": "neurology", "label": "Neurology", "capacity": 4, "color": "#6366f1", "icon": "Brain"},
    {"name": "orthopedics", "label": "Orthopedics", "capacity": 3, "color": "#14b8a6", "icon": "Bone"},
    {"name": "radiology", "label": "Radiology", "capacity": 5, "color": "#f59e0b", "icon": "Scan"},
    {"name": "internal_medicine", "label": "Internal Medicine", "capacity": 6, "color": "#8b5cf6", "icon": "Stethoscope"},
    {"name": "general_checkup", "label": "General Check-up", "capacity": 3, "color": "#94a3b8", "icon": "ClipboardCheck"},
    {"name": "dermatology", "label": "Dermatology", "capacity": 3, "color": "#ec4899", "icon": "Hand"},
    {"name": "gastroenterology", "label": "Gastroenterology", "capacity": 3, "color": "#f97316", "icon": "Pill"},
    {"name": "pulmonology", "label": "Pulmonology", "capacity": 3, "color": "#06b6d4", "icon": "Wind"},
    {"name": "endocrinology", "label": "Endocrinology", "capacity": 3, "color": "#a855f7", "icon": "Droplets"},
    {"name": "ophthalmology", "label": "Ophthalmology", "capacity": 3, "color": "#3b82f6", "icon": "Eye"},
    {"name": "ent", "label": "ENT", "capacity": 2, "color": "#fb923c", "icon": "Ear"},
    {"name": "urology", "label": "Urology", "capacity": 3, "color": "#22d3ee", "icon": "Activity"},
]
```

- [ ] **Step 5: Export Department from models __init__**

Add to `src/models/__init__.py`:
```python
from .department import Department
```

And add `Department` to the `__all__` list.

- [ ] **Step 6: Run tests to verify they pass**

Run: `pytest tests/test_department_model.py -v`
Expected: 2 tests PASS

- [ ] **Step 7: Commit**

```bash
git add src/models/department.py src/constants/department_seed_data.py src/models/__init__.py tests/test_department_model.py
git commit -m "feat: add Department model with seed data"
```

---

## Task 2: Visit Model Changes

**Files:**
- Modify: `src/models/visit.py:27-59`
- Test: `tests/test_department_model.py` (extend)

- [ ] **Step 1: Write failing test for new Visit fields**

Add to `tests/test_department_model.py`:

```python
from src.models.visit import Visit, VisitStatus
from src.models.patient import Patient


@pytest_asyncio.fixture
async def sample_patient(db_session: AsyncSession) -> Patient:
    patient = Patient(name="Test Patient", dob="1990-01-01", gender="male")
    db_session.add(patient)
    await db_session.commit()
    await db_session.refresh(patient)
    return patient


@pytest.mark.asyncio
async def test_visit_current_department_field(
    db_session: AsyncSession, sample_patient: Patient, sample_department: Department
):
    visit = Visit(
        visit_id="VIS-20260325-001",
        patient_id=sample_patient.id,
        status=VisitStatus.IN_DEPARTMENT.value,
        current_department="cardiology",
        queue_position=1,
    )
    db_session.add(visit)
    await db_session.commit()
    await db_session.refresh(visit)
    assert visit.current_department == "cardiology"
    assert visit.queue_position == 1


@pytest.mark.asyncio
async def test_visit_current_department_nullable(
    db_session: AsyncSession, sample_patient: Patient
):
    visit = Visit(
        visit_id="VIS-20260325-002",
        patient_id=sample_patient.id,
        status=VisitStatus.INTAKE.value,
    )
    db_session.add(visit)
    await db_session.commit()
    await db_session.refresh(visit)
    assert visit.current_department is None
    assert visit.queue_position is None
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/test_department_model.py::test_visit_current_department_field -v`
Expected: FAIL — `Visit` has no `current_department` attribute

- [ ] **Step 3: Add fields to Visit model**

In `src/models/visit.py`, add after the `reviewed_by` field (line 46):

```python
    current_department: Mapped[Optional[str]] = mapped_column(
        String(50), ForeignKey("departments.name"), nullable=True
    )
    queue_position: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
```

Also add `Integer` to the sqlalchemy imports at the top.

- [ ] **Step 4: Run tests to verify they pass**

Run: `pytest tests/test_department_model.py -v`
Expected: All 4 tests PASS

- [ ] **Step 5: Create Alembic migration**

Run: `alembic revision --autogenerate -m "add departments table and visit department fields"`

Verify the generated migration creates the `departments` table and adds `current_department` + `queue_position` columns to `visits`.

- [ ] **Step 6: Run migration**

Run: `alembic upgrade head`

- [ ] **Step 7: Commit**

```bash
git add src/models/visit.py alembic/versions/ tests/test_department_model.py
git commit -m "feat: add current_department and queue_position to Visit model"
```

---

## Task 3: Department API Endpoints

**Files:**
- Create: `src/api/routers/departments.py`
- Modify: `src/api/models.py:276-311`
- Modify: `src/api/server.py:114-121`
- Test: `tests/test_department_api.py`

- [ ] **Step 1: Add Pydantic schemas for departments**

Add to `src/api/models.py`:

```python
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
```

- [ ] **Step 2: Write failing tests for department endpoints**

```python
# tests/test_department_api.py
import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport

from src.api.server import app
from src.models.department import Department
from src.models.base import get_db


@pytest_asyncio.fixture
async def client(db_session):
    async def override_get_db():
        yield db_session
    app.dependency_overrides[get_db] = override_get_db
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield client
    app.dependency_overrides.clear()


@pytest_asyncio.fixture
async def seeded_departments(db_session):
    from src.constants.department_seed_data import DEPARTMENT_SEED_DATA
    for data in DEPARTMENT_SEED_DATA:
        dept = Department(**data, is_open=True)
        db_session.add(dept)
    await db_session.commit()


@pytest.mark.asyncio
async def test_list_departments(client, seeded_departments):
    response = await client.get("/api/departments")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 14
    cardio = next(d for d in data if d["name"] == "cardiology")
    assert cardio["capacity"] == 4
    assert cardio["status"] == "IDLE"
    assert cardio["current_patient_count"] == 0


@pytest.mark.asyncio
async def test_update_department(client, seeded_departments):
    response = await client.patch(
        "/api/departments/cardiology",
        json={"capacity": 8, "is_open": False},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["capacity"] == 8
    assert data["is_open"] is False


@pytest.mark.asyncio
async def test_update_nonexistent_department(client, seeded_departments):
    response = await client.patch(
        "/api/departments/fake_dept",
        json={"capacity": 5},
    )
    assert response.status_code == 404
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `pytest tests/test_department_api.py -v`
Expected: FAIL — route not found (404 for /api/departments)

- [ ] **Step 4: Create department router**

```python
# src/api/routers/departments.py
"""Department API endpoints."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.models import DepartmentResponse, DepartmentUpdate
from src.models.base import get_db
from src.models.department import Department
from src.models.visit import Visit, VisitStatus

router = APIRouter(prefix="/api/departments", tags=["Departments"])


def _compute_department_status(patient_count: int, capacity: int) -> str:
    if capacity == 0:
        return "IDLE"
    ratio = patient_count / capacity
    if ratio < 0.25:
        return "IDLE"
    elif ratio < 0.60:
        return "OK"
    elif ratio < 0.85:
        return "BUSY"
    return "CRITICAL"


@router.get("", response_model=list[DepartmentResponse])
async def list_departments(db: AsyncSession = Depends(get_db)):
    """List all departments with live patient counts and status."""
    result = await db.execute(select(Department).order_by(Department.name))
    departments = result.scalars().all()

    # Count patients per department
    count_query = (
        select(Visit.current_department, func.count(Visit.id))
        .where(Visit.status == VisitStatus.IN_DEPARTMENT.value)
        .where(Visit.current_department.isnot(None))
        .group_by(Visit.current_department)
    )
    count_result = await db.execute(count_query)
    patient_counts = dict(count_result.all())

    responses = []
    for dept in departments:
        count = patient_counts.get(dept.name, 0)
        responses.append(DepartmentResponse(
            name=dept.name,
            label=dept.label,
            capacity=dept.capacity,
            is_open=dept.is_open,
            color=dept.color,
            icon=dept.icon,
            current_patient_count=count,
            queue_length=max(0, count - dept.capacity) if count > dept.capacity else 0,
            status=_compute_department_status(count, dept.capacity),
        ))
    return responses


@router.patch("/{name}", response_model=DepartmentResponse)
async def update_department(
    name: str,
    update: DepartmentUpdate,
    db: AsyncSession = Depends(get_db),
):
    """Update department capacity or open/close status."""
    result = await db.execute(select(Department).where(Department.name == name))
    dept = result.scalar_one_or_none()
    if not dept:
        raise HTTPException(status_code=404, detail=f"Department '{name}' not found")

    if update.capacity is not None:
        dept.capacity = update.capacity
    if update.is_open is not None:
        dept.is_open = update.is_open

    await db.commit()
    await db.refresh(dept)

    # Get current patient count
    count_result = await db.execute(
        select(func.count(Visit.id))
        .where(Visit.current_department == name)
        .where(Visit.status == VisitStatus.IN_DEPARTMENT.value)
    )
    count = count_result.scalar() or 0

    return DepartmentResponse(
        name=dept.name,
        label=dept.label,
        capacity=dept.capacity,
        is_open=dept.is_open,
        color=dept.color,
        icon=dept.icon,
        current_patient_count=count,
        queue_length=max(0, count - dept.capacity) if count > dept.capacity else 0,
        status=_compute_department_status(count, dept.capacity),
    )
```

- [ ] **Step 5: Register router in server.py**

Add to `src/api/server.py` after line 121:

```python
from src.api.routers import departments
app.include_router(departments.router)
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `pytest tests/test_department_api.py -v`
Expected: All 3 tests PASS

- [ ] **Step 7: Commit**

```bash
git add src/api/routers/departments.py src/api/models.py src/api/server.py tests/test_department_api.py
git commit -m "feat: add department API endpoints (list, update)"
```

---

## Task 4: Visit Transfer Endpoint

**Files:**
- Modify: `src/api/routers/visits.py:158-185`
- Modify: `src/api/models.py`
- Test: `tests/test_visit_transfer.py`

- [ ] **Step 1: Add transfer request schema**

Add to `src/api/models.py`:

```python
class VisitTransferRequest(BaseModel):
    target_department: str
```

- [ ] **Step 2: Write failing tests for transfer**

```python
# tests/test_visit_transfer.py
import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from sqlalchemy import select

from src.api.server import app
from src.models.base import get_db
from src.models.department import Department
from src.models.visit import Visit, VisitStatus
from src.models.patient import Patient


@pytest_asyncio.fixture
async def client(db_session):
    async def override_get_db():
        yield db_session
    app.dependency_overrides[get_db] = override_get_db
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield client
    app.dependency_overrides.clear()


@pytest_asyncio.fixture
async def setup_transfer(db_session):
    """Create departments + patient + visit in cardiology."""
    cardio = Department(name="cardiology", label="Cardiology", capacity=4, is_open=True, color="#10b981", icon="Heart")
    radiology = Department(name="radiology", label="Radiology", capacity=5, is_open=True, color="#f59e0b", icon="Scan")
    closed_dept = Department(name="ent", label="ENT", capacity=2, is_open=False, color="#fb923c", icon="Ear")
    db_session.add_all([cardio, radiology, closed_dept])
    patient = Patient(name="John Doe", dob="1990-01-01", gender="male")
    db_session.add(patient)
    await db_session.flush()

    visit = Visit(
        visit_id="VIS-20260325-001",
        patient_id=patient.id,
        status=VisitStatus.IN_DEPARTMENT.value,
        current_department="cardiology",
        queue_position=1,
    )
    db_session.add(visit)
    await db_session.commit()
    return visit


@pytest.mark.asyncio
async def test_transfer_success(client, setup_transfer):
    visit = setup_transfer
    response = await client.post(
        f"/api/visits/{visit.id}/transfer",
        json={"target_department": "radiology"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["current_department"] == "radiology"


@pytest.mark.asyncio
async def test_transfer_to_closed_department(client, setup_transfer):
    visit = setup_transfer
    response = await client.post(
        f"/api/visits/{visit.id}/transfer",
        json={"target_department": "ent"},
    )
    assert response.status_code == 400


@pytest.mark.asyncio
async def test_transfer_to_full_department(client, db_session, setup_transfer):
    """Transfer should fail when target department is at capacity."""
    visit = setup_transfer
    # Fill radiology to capacity (capacity=5)
    patient = (await db_session.execute(select(Patient).limit(1))).scalar_one()
    for i in range(5):
        v = Visit(
            visit_id=f"VIS-20260325-1{i:02d}",
            patient_id=patient.id,
            status=VisitStatus.IN_DEPARTMENT.value,
            current_department="radiology",
            queue_position=i + 1,
        )
        db_session.add(v)
    await db_session.commit()

    response = await client.post(
        f"/api/visits/{visit.id}/transfer",
        json={"target_department": "radiology"},
    )
    assert response.status_code == 400
    assert "capacity" in response.json()["detail"].lower()


@pytest.mark.asyncio
async def test_transfer_non_department_visit(client, db_session):
    patient = Patient(name="Jane Doe", dob="1985-05-15", gender="female")
    db_session.add(patient)
    await db_session.flush()
    visit = Visit(
        visit_id="VIS-20260325-002",
        patient_id=patient.id,
        status=VisitStatus.INTAKE.value,
    )
    db_session.add(visit)
    await db_session.commit()

    response = await client.post(
        f"/api/visits/{visit.id}/transfer",
        json={"target_department": "radiology"},
    )
    assert response.status_code == 400
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `pytest tests/test_visit_transfer.py -v`
Expected: FAIL — 405 Method Not Allowed (endpoint doesn't exist)

- [ ] **Step 4: Implement transfer endpoint**

First, update imports at top of `src/api/routers/visits.py` (line 6):

Change:
```python
from sqlalchemy import select
```
To:
```python
from sqlalchemy import func, select
```

Add import after line 11:
```python
from ..models import VisitCreate, VisitResponse, VisitListResponse, VisitDetailResponse, VisitRouteUpdate, VisitTransferRequest
from src.models.department import Department
```

Then add the transfer endpoint at the end of the file:

```python
@router.post("/api/visits/{visit_id}/transfer", response_model=VisitResponse)
async def transfer_visit(
    visit_id: int,
    transfer: VisitTransferRequest,
    db: AsyncSession = Depends(get_db),
):
    """Transfer a patient between departments."""
    # Get visit
    result = await db.execute(select(Visit).where(Visit.id == visit_id))
    visit = result.scalar_one_or_none()
    if not visit:
        raise HTTPException(status_code=404, detail="Visit not found")

    if visit.status != VisitStatus.IN_DEPARTMENT.value:
        raise HTTPException(status_code=400, detail="Visit must be in_department to transfer")

    # Check target department
    dept_result = await db.execute(
        select(Department).where(Department.name == transfer.target_department)
    )
    target_dept = dept_result.scalar_one_or_none()
    if not target_dept:
        raise HTTPException(status_code=404, detail="Target department not found")
    if not target_dept.is_open:
        raise HTTPException(status_code=400, detail="Target department is closed")

    # Check capacity
    count_result = await db.execute(
        select(func.count(Visit.id))
        .where(Visit.current_department == transfer.target_department)
        .where(Visit.status == VisitStatus.IN_DEPARTMENT.value)
    )
    current_count = count_result.scalar() or 0
    if current_count >= target_dept.capacity:
        raise HTTPException(status_code=400, detail="Target department is at capacity")

    # Compact source department queue positions
    source_dept = visit.current_department
    source_visits_result = await db.execute(
        select(Visit)
        .where(Visit.current_department == source_dept)
        .where(Visit.status == VisitStatus.IN_DEPARTMENT.value)
        .where(Visit.queue_position > visit.queue_position)
        .order_by(Visit.queue_position)
    )
    for v in source_visits_result.scalars().all():
        v.queue_position -= 1

    # Get next queue position in target department
    max_pos_result = await db.execute(
        select(func.max(Visit.queue_position))
        .where(Visit.current_department == transfer.target_department)
        .where(Visit.status == VisitStatus.IN_DEPARTMENT.value)
    )
    max_pos = max_pos_result.scalar() or 0

    # Transfer
    visit.current_department = transfer.target_department
    visit.queue_position = max_pos + 1

    await db.commit()
    await db.refresh(visit)
    return _visit_to_response(visit)
```

- [ ] **Step 5: Update check_in_visit to set current_department and queue_position**

Replace the entire `check_in_visit` function in `src/api/routers/visits.py` (lines 158-170) with:

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

    # Set current_department to first department in routing_decision
    if visit.routing_decision:
        visit.current_department = visit.routing_decision[0]

    # Get next queue position in target department
    max_pos_result = await db.execute(
        select(func.max(Visit.queue_position))
        .where(Visit.current_department == visit.current_department)
        .where(Visit.status == VisitStatus.IN_DEPARTMENT.value)
    )
    max_pos = max_pos_result.scalar() or 0
    visit.queue_position = max_pos + 1

    await db.commit()
    await db.refresh(visit)
    return _visit_to_response(visit)
```

- [ ] **Step 6: Update complete_visit to clear current_department**

Replace the entire `complete_visit` function in `src/api/routers/visits.py` (lines 173-185) with:

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

    # Compact queue positions in departing department
    if visit.current_department and visit.queue_position:
        source_visits_result = await db.execute(
            select(Visit)
            .where(Visit.current_department == visit.current_department)
            .where(Visit.status == VisitStatus.IN_DEPARTMENT.value)
            .where(Visit.queue_position > visit.queue_position)
            .order_by(Visit.queue_position)
        )
        for v in source_visits_result.scalars().all():
            v.queue_position -= 1

    visit.status = VisitStatus.COMPLETED.value
    visit.current_department = None
    visit.queue_position = None

    await db.commit()
    await db.refresh(visit)
    return _visit_to_response(visit)
```

- [ ] **Step 7: Update _visit_to_response and VisitResponse**

Replace `_visit_to_response` in `src/api/routers/visits.py` (lines 18-29) with:

```python
def _visit_to_response(v: Visit) -> VisitResponse:
    return VisitResponse(
        id=v.id, visit_id=v.visit_id, patient_id=v.patient_id,
        status=v.status, confidence=v.confidence,
        routing_suggestion=v.routing_suggestion,
        routing_decision=v.routing_decision,
        chief_complaint=v.chief_complaint,
        intake_session_id=v.intake_session_id,
        reviewed_by=v.reviewed_by,
        current_department=v.current_department,
        queue_position=v.queue_position,
        created_at=v.created_at.isoformat(),
        updated_at=v.updated_at.isoformat(),
    )
```

Also add these two fields to `VisitResponse` in `src/api/models.py` (after `reviewed_by` field):

```python
    current_department: str | None = None
    queue_position: int | None = None
```

- [ ] **Step 8: Add tests for updated check_in and complete behavior**

Add to `tests/test_visit_transfer.py`:

```python
@pytest.mark.asyncio
async def test_check_in_sets_current_department(client, db_session):
    """check_in_visit should set current_department and queue_position."""
    # Create department
    dept = Department(name="cardiology", label="Cardiology", capacity=4, is_open=True, color="#10b981", icon="Heart")
    db_session.add(dept)
    patient = Patient(name="Alice", dob="1992-03-15", gender="female")
    db_session.add(patient)
    await db_session.flush()

    visit = Visit(
        visit_id="VIS-20260325-010",
        patient_id=patient.id,
        status=VisitStatus.ROUTED.value,
        routing_decision=["cardiology"],
    )
    db_session.add(visit)
    await db_session.commit()

    response = await client.patch(f"/api/visits/{visit.id}/check-in")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "in_department"
    assert data["current_department"] == "cardiology"
    assert data["queue_position"] == 1


@pytest.mark.asyncio
async def test_complete_clears_department_and_compacts(client, db_session):
    """complete_visit should clear current_department, queue_position, and compact remaining."""
    dept = Department(name="cardiology", label="Cardiology", capacity=4, is_open=True, color="#10b981", icon="Heart")
    db_session.add(dept)
    patient = Patient(name="Bob", dob="1985-07-20", gender="male")
    db_session.add(patient)
    await db_session.flush()

    # Two patients in department
    visit1 = Visit(
        visit_id="VIS-20260325-020",
        patient_id=patient.id,
        status=VisitStatus.IN_DEPARTMENT.value,
        current_department="cardiology",
        queue_position=1,
    )
    visit2 = Visit(
        visit_id="VIS-20260325-021",
        patient_id=patient.id,
        status=VisitStatus.IN_DEPARTMENT.value,
        current_department="cardiology",
        queue_position=2,
    )
    db_session.add_all([visit1, visit2])
    await db_session.commit()

    # Complete first patient
    response = await client.patch(f"/api/visits/{visit1.id}/complete")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "completed"
    assert data["current_department"] is None
    assert data["queue_position"] is None

    # Second patient should have compacted queue_position
    await db_session.refresh(visit2)
    assert visit2.queue_position == 1
```

- [ ] **Step 9: Run tests to verify they pass**

Run: `pytest tests/test_visit_transfer.py -v`
Expected: All 6 tests PASS

- [ ] **Step 10: Commit**

```bash
git add src/api/routers/visits.py src/api/models.py tests/test_visit_transfer.py
git commit -m "feat: add visit transfer endpoint with queue management"
```

---

## Task 5: Hospital Stats Endpoint

**Files:**
- Create: `src/api/routers/hospital.py`
- Modify: `src/api/server.py`
- Test: `tests/test_hospital_stats.py`

- [ ] **Step 1: Write failing test**

```python
# tests/test_hospital_stats.py
import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport

from src.api.server import app
from src.models.base import get_db
from src.models.department import Department
from src.models.visit import Visit, VisitStatus
from src.models.patient import Patient


@pytest_asyncio.fixture
async def client(db_session):
    async def override_get_db():
        yield db_session
    app.dependency_overrides[get_db] = override_get_db
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield client
    app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_hospital_stats_empty(client):
    response = await client.get("/api/hospital/stats")
    assert response.status_code == 200
    data = response.json()
    assert data["active_patients"] == 0
    assert data["departments_at_capacity"] == 0
    assert data["avg_wait_minutes"] == 0.0
    assert data["discharged_today"] == 0
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/test_hospital_stats.py -v`
Expected: FAIL — 404 (endpoint doesn't exist)

- [ ] **Step 3: Create hospital stats router**

```python
# src/api/routers/hospital.py
"""Hospital-level KPI endpoints."""
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.models.base import get_db
from src.models.department import Department
from src.models.visit import Visit, VisitStatus


class HospitalStats(BaseModel):
    active_patients: int
    departments_at_capacity: int
    avg_wait_minutes: float
    discharged_today: int


router = APIRouter(prefix="/api/hospital", tags=["Hospital"])


@router.get("/stats", response_model=HospitalStats)
async def get_hospital_stats(db: AsyncSession = Depends(get_db)):
    """Get aggregated hospital KPIs."""
    # Active patients (all non-completed visits)
    active_result = await db.execute(
        select(func.count(Visit.id))
        .where(Visit.status != VisitStatus.COMPLETED.value)
    )
    active_patients = active_result.scalar() or 0

    # Departments at capacity
    dept_result = await db.execute(select(Department))
    departments = dept_result.scalars().all()

    count_result = await db.execute(
        select(Visit.current_department, func.count(Visit.id))
        .where(Visit.status == VisitStatus.IN_DEPARTMENT.value)
        .where(Visit.current_department.isnot(None))
        .group_by(Visit.current_department)
    )
    patient_counts = dict(count_result.all())

    at_capacity = sum(
        1 for dept in departments
        if patient_counts.get(dept.name, 0) >= dept.capacity
    )

    # Average wait time (time since created_at for active visits)
    active_visits_result = await db.execute(
        select(Visit.created_at)
        .where(Visit.status != VisitStatus.COMPLETED.value)
    )
    created_times = active_visits_result.scalars().all()
    if created_times:
        now = datetime.utcnow()
        total_minutes = sum(
            (now - ct).total_seconds() / 60 for ct in created_times
        )
        avg_wait = round(total_minutes / len(created_times), 1)
    else:
        avg_wait = 0.0

    # Discharged today
    today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    discharged_result = await db.execute(
        select(func.count(Visit.id))
        .where(Visit.status == VisitStatus.COMPLETED.value)
        .where(Visit.updated_at >= today_start)
    )
    discharged_today = discharged_result.scalar() or 0

    return HospitalStats(
        active_patients=active_patients,
        departments_at_capacity=at_capacity,
        avg_wait_minutes=avg_wait,
        discharged_today=discharged_today,
    )
```

- [ ] **Step 4: Register router in server.py**

Add to `src/api/server.py`:

```python
from src.api.routers import hospital
app.include_router(hospital.router)
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pytest tests/test_hospital_stats.py -v`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/api/routers/hospital.py src/api/server.py tests/test_hospital_stats.py
git commit -m "feat: add hospital stats KPI endpoint"
```

---

## Task 6: Seed Departments on Startup

**Files:**
- Modify: `src/api/server.py`

- [ ] **Step 1: Add department seeding to the existing lifespan function**

The app uses the modern `lifespan` context manager pattern (line 81-91). Add seeding logic inside it, after `init_db()`:

In `src/api/server.py`, add imports at the top:

```python
from sqlalchemy import func, select
from src.models.department import Department
from src.models.base import AsyncSessionLocal
from src.constants.department_seed_data import DEPARTMENT_SEED_DATA
```

Then modify the existing `lifespan` function (line 81-91) to become:

```python
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manage application lifespan events (startup and shutdown)."""
    # Startup: Initialize database
    await init_db()
    logger.info("Database initialized")

    # Startup: Seed departments if empty
    async with AsyncSessionLocal() as session:
        result = await session.execute(select(func.count(Department.id)))
        count = result.scalar() or 0
        if count == 0:
            for data in DEPARTMENT_SEED_DATA:
                session.add(Department(**data, is_open=True))
            await session.commit()
            logger.info(f"Seeded {len(DEPARTMENT_SEED_DATA)} departments")

    # Startup: Discover skills
    await discover_skills_on_startup()

    yield
```

- [ ] **Step 2: Verify server starts without errors**

Run: `python -c "from src.api.server import app; print('OK')"`
Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add src/api/server.py
git commit -m "feat: seed departments table on startup"
```

---

## Task 7: Frontend API Functions

**Files:**
- Modify: `web/lib/api.ts`

- [ ] **Step 1: Add TypeScript interfaces for departments and stats**

Add to `web/lib/api.ts`:

```typescript
export interface DepartmentInfo {
  name: string;
  label: string;
  capacity: number;
  is_open: boolean;
  color: string;
  icon: string;
  current_patient_count: number;
  queue_length: number;
  status: "IDLE" | "OK" | "BUSY" | "CRITICAL";
}

export interface HospitalStats {
  active_patients: number;
  departments_at_capacity: number;
  avg_wait_minutes: number;
  discharged_today: number;
}
```

- [ ] **Step 2: Update Visit interface with new fields**

Add to the `Visit` interface:

```typescript
  current_department: string | null;
  queue_position: number | null;
```

- [ ] **Step 3: Add department and hospital API functions**

```typescript
export async function listDepartments(): Promise<DepartmentInfo[]> {
  const response = await fetch(`${API_BASE_URL}/departments`);
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to fetch departments");
  }
  return response.json();
}

export async function updateDepartment(
  name: string,
  update: { capacity?: number; is_open?: boolean }
): Promise<DepartmentInfo> {
  const response = await fetch(`${API_BASE_URL}/departments/${name}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(update),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to update department");
  }
  return response.json();
}

export async function transferVisit(
  visitId: number,
  targetDepartment: string
): Promise<Visit> {
  const response = await fetch(`${API_BASE_URL}/visits/${visitId}/transfer`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ target_department: targetDepartment }),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to transfer visit");
  }
  return response.json();
}

export async function getHospitalStats(): Promise<HospitalStats> {
  const response = await fetch(`${API_BASE_URL}/hospital/stats`);
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to fetch hospital stats");
  }
  return response.json();
}
```

- [ ] **Step 4: Verify TypeScript compiles**

Run: `cd web && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add web/lib/api.ts
git commit -m "feat: add department, transfer, and hospital stats API functions"
```

---

## Task 8: Operations Constants & Shared Types

**Files:**
- Create: `web/components/operations/operations-constants.ts`

- [ ] **Step 1: Create operations constants file**

```typescript
// web/components/operations/operations-constants.ts

/** Status colors and labels for the operations canvas. */

export const RECEPTION_STATUSES = ["intake", "triaged", "auto_routed", "pending_review", "routed"] as const;
export const DEPARTMENT_STATUS = "in_department" as const;

export const WAIT_TIME_COLORS = {
  short: "#00d9ff",   // < 10 minutes — cyan
  medium: "#f59e0b",  // 10-30 minutes — amber
  long: "#ef4444",    // > 30 minutes — red
} as const;

export function getWaitTimeColor(createdAt: string): string {
  const minutes = (Date.now() - new Date(createdAt).getTime()) / 60000;
  if (minutes < 10) return WAIT_TIME_COLORS.short;
  if (minutes < 30) return WAIT_TIME_COLORS.medium;
  return WAIT_TIME_COLORS.long;
}

export function formatTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export const DEPARTMENT_STATUS_COLORS = {
  IDLE: "#6b7280",
  OK: "#10b981",
  BUSY: "#f59e0b",
  CRITICAL: "#ef4444",
} as const;

/** Default canvas layout positions. */
export const CANVAS_LAYOUT = {
  RECEPTION_Y: 50,
  DEPARTMENT_START_Y: 250,
  DEPARTMENT_ROW_GAP: 220,
  DEPARTMENT_COL_GAP: 200,
  DEPARTMENTS_PER_ROW: 7,
  DISCHARGE_Y: 750,
  CENTER_X: 700,
} as const;
```

- [ ] **Step 2: Commit**

```bash
git add web/components/operations/operations-constants.ts
git commit -m "feat: add operations canvas constants and utility functions"
```

---

## Task 9: Data Fetching Hook

**Files:**
- Create: `web/components/operations/use-hospital-canvas.ts`

- [ ] **Step 1: Create the hook**

```typescript
// web/components/operations/use-hospital-canvas.ts
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Node, Edge } from "@xyflow/react";

import {
  listDepartments,
  listActiveVisits,
  getHospitalStats,
  type DepartmentInfo,
  type HospitalStats,
  type VisitListItem,
} from "@/lib/api";
import { CANVAS_LAYOUT, RECEPTION_STATUSES } from "./operations-constants";

export interface CanvasData {
  nodes: Node[];
  edges: Edge[];
  departments: DepartmentInfo[];
  visits: VisitListItem[];
  stats: HospitalStats;
  receptionVisits: VisitListItem[];
  departmentVisits: Record<string, VisitListItem[]>;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

const POLL_INTERVAL = 5000;

const SAVED_POSITIONS_KEY = "hospital-canvas-positions";

function loadSavedPositions(): Record<string, { x: number; y: number }> {
  try {
    const saved = localStorage.getItem(SAVED_POSITIONS_KEY);
    return saved ? JSON.parse(saved) : {};
  } catch {
    return {};
  }
}

function savePositions(positions: Record<string, { x: number; y: number }>) {
  localStorage.setItem(SAVED_POSITIONS_KEY, JSON.stringify(positions));
}

function buildDefaultLayout(departments: DepartmentInfo[]): Record<string, { x: number; y: number }> {
  const sorted = [...departments].sort((a, b) => a.name.localeCompare(b.name));
  const positions: Record<string, { x: number; y: number }> = {};

  // Reception at top center
  positions["reception"] = { x: CANVAS_LAYOUT.CENTER_X, y: CANVAS_LAYOUT.RECEPTION_Y };

  // Departments in 2 rows of 7
  sorted.forEach((dept, i) => {
    const row = Math.floor(i / CANVAS_LAYOUT.DEPARTMENTS_PER_ROW);
    const col = i % CANVAS_LAYOUT.DEPARTMENTS_PER_ROW;
    positions[dept.name] = {
      x: col * CANVAS_LAYOUT.DEPARTMENT_COL_GAP + 50,
      y: CANVAS_LAYOUT.DEPARTMENT_START_Y + row * CANVAS_LAYOUT.DEPARTMENT_ROW_GAP,
    };
  });

  // Discharge at bottom center
  positions["discharge"] = { x: CANVAS_LAYOUT.CENTER_X, y: CANVAS_LAYOUT.DISCHARGE_Y };

  return positions;
}

function buildNodes(
  departments: DepartmentInfo[],
  visits: VisitListItem[],
  positions: Record<string, { x: number; y: number }>,
): Node[] {
  const receptionVisits = visits.filter((v) =>
    (RECEPTION_STATUSES as readonly string[]).includes(v.status)
  );
  const departmentVisits: Record<string, VisitListItem[]> = {};
  visits
    .filter((v) => v.status === "in_department" && v.current_department)
    .forEach((v) => {
      const dept = v.current_department!;
      if (!departmentVisits[dept]) departmentVisits[dept] = [];
      departmentVisits[dept].push(v);
    });

  const nodes: Node[] = [];

  // Reception node
  nodes.push({
    id: "reception",
    type: "reception",
    position: positions["reception"] || { x: CANVAS_LAYOUT.CENTER_X, y: CANVAS_LAYOUT.RECEPTION_Y },
    data: { visits: receptionVisits },
  });

  // Department nodes
  for (const dept of departments) {
    nodes.push({
      id: dept.name,
      type: "department",
      position: positions[dept.name] || { x: 0, y: 0 },
      data: {
        department: dept,
        visits: departmentVisits[dept.name] || [],
      },
    });
  }

  // Discharge node
  const dischargedToday = visits.filter((v) => v.status === "completed");
  nodes.push({
    id: "discharge",
    type: "discharge",
    position: positions["discharge"] || { x: CANVAS_LAYOUT.CENTER_X, y: CANVAS_LAYOUT.DISCHARGE_Y },
    data: { count: dischargedToday.length },
  });

  return nodes;
}

function buildEdges(departments: DepartmentInfo[], departmentVisits: Record<string, VisitListItem[]>): Edge[] {
  const edges: Edge[] = [];
  const maxCount = Math.max(1, ...Object.values(departmentVisits).map((v) => v.length));

  for (const dept of departments) {
    const count = (departmentVisits[dept.name] || []).length;
    edges.push({
      id: `reception-${dept.name}`,
      source: "reception",
      target: dept.name,
      type: "flow",
      data: { opacity: count > 0 ? 0.15 + (count / maxCount) * 0.6 : 0.08 },
      animated: true,
    });
  }

  return edges;
}

export function useHospitalCanvas(): CanvasData {
  const [departments, setDepartments] = useState<DepartmentInfo[]>([]);
  const [visits, setVisits] = useState<VisitListItem[]>([]);
  const [stats, setStats] = useState<HospitalStats>({
    active_patients: 0,
    departments_at_capacity: 0,
    avg_wait_minutes: 0,
    discharged_today: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const positionsRef = useRef<Record<string, { x: number; y: number }>>(loadSavedPositions());
  const initializedRef = useRef(false);

  const fetchData = useCallback(async () => {
    try {
      const [depts, vis, st] = await Promise.all([
        listDepartments(),
        listActiveVisits(),
        getHospitalStats(),
      ]);
      setDepartments(depts);
      setVisits(vis);
      setStats(st);
      setError(null);

      // Initialize positions on first load if none saved
      if (!initializedRef.current && Object.keys(positionsRef.current).length === 0) {
        positionsRef.current = buildDefaultLayout(depts);
        savePositions(positionsRef.current);
      }
      initializedRef.current = true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchData]);

  const receptionVisits = visits.filter((v) =>
    (RECEPTION_STATUSES as readonly string[]).includes(v.status)
  );
  const departmentVisits: Record<string, VisitListItem[]> = {};
  visits
    .filter((v) => v.status === "in_department" && v.current_department)
    .forEach((v) => {
      const dept = v.current_department!;
      if (!departmentVisits[dept]) departmentVisits[dept] = [];
      departmentVisits[dept].push(v);
    });

  const nodes = buildNodes(departments, visits, positionsRef.current);
  const edges = buildEdges(departments, departmentVisits);

  return {
    nodes,
    edges,
    departments,
    visits,
    stats,
    receptionVisits,
    departmentVisits,
    loading,
    error,
    refresh: fetchData,
  };
}

/** Call this when a node is dragged to persist its position. */
export function onNodeDragStop(nodeId: string, position: { x: number; y: number }) {
  const positions = loadSavedPositions();
  positions[nodeId] = position;
  savePositions(positions);
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd web && npx tsc --noEmit`
Expected: No errors (or only pre-existing errors)

- [ ] **Step 3: Commit**

```bash
git add web/components/operations/use-hospital-canvas.ts
git commit -m "feat: add useHospitalCanvas data hook with polling and layout"
```

---

## Task 10: Custom Canvas Nodes — DepartmentNode

**Files:**
- Create: `web/components/operations/canvas/department-node.tsx`
- Create: `web/components/operations/canvas/queue-tail.tsx`
- Create: `web/components/operations/canvas/patient-dot.tsx`

- [ ] **Step 1: Create PatientDot component**

```typescript
// web/components/operations/canvas/patient-dot.tsx
"use client";

import { useState } from "react";
import type { VisitListItem } from "@/lib/api";
import { getWaitTimeColor } from "../operations-constants";
import { PatientPopover } from "./patient-popover";

interface PatientDotProps {
  visit: VisitListItem;
  index: number;
}

export function PatientDot({ visit, index }: PatientDotProps) {
  const [showPopover, setShowPopover] = useState(false);
  const color = getWaitTimeColor(visit.created_at);

  return (
    <div className="relative" style={{ marginLeft: index === 0 ? 0 : -4 }}>
      <button
        onClick={(e) => {
          e.stopPropagation();
          setShowPopover(!showPopover);
        }}
        className="relative flex items-center justify-center rounded-full transition-transform hover:scale-125"
        style={{
          width: 14,
          height: 14,
          backgroundColor: color,
          boxShadow: `0 0 6px ${color}80`,
          animation: "pulse 2s ease-in-out infinite",
          animationDelay: `${index * 0.3}s`,
        }}
        title={visit.patient_name}
      />
      {showPopover && (
        <PatientPopover visit={visit} onClose={() => setShowPopover(false)} />
      )}
    </div>
  );
}
```

- [ ] **Step 2: Create QueueTail component**

```typescript
// web/components/operations/canvas/queue-tail.tsx
"use client";

import type { VisitListItem } from "@/lib/api";
import { PatientDot } from "./patient-dot";

interface QueueTailProps {
  visits: VisitListItem[];
}

const MAX_VISIBLE = 6;

export function QueueTail({ visits }: QueueTailProps) {
  if (visits.length === 0) return null;

  const sorted = [...visits].sort(
    (a, b) => (a.queue_position ?? 0) - (b.queue_position ?? 0)
  );
  const visible = sorted.slice(0, MAX_VISIBLE);
  const overflow = sorted.length - MAX_VISIBLE;

  return (
    <div className="flex items-center gap-0.5 absolute -left-2 top-1/2 -translate-x-full -translate-y-1/2">
      <div className="flex items-center flex-row-reverse gap-0.5">
        {visible.map((visit, i) => (
          <PatientDot key={visit.id} visit={visit} index={i} />
        ))}
      </div>
      {overflow > 0 && (
        <span
          className="text-xs font-mono ml-1 rounded-full px-1.5 py-0.5"
          style={{ color: "#8b949e", background: "rgba(255,255,255,0.05)" }}
        >
          +{overflow}
        </span>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Create DepartmentNode component**

```typescript
// web/components/operations/canvas/department-node.tsx
"use client";

import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import type { DepartmentInfo, VisitListItem } from "@/lib/api";
import { DEPARTMENT_STATUS_COLORS } from "../operations-constants";
import { QueueTail } from "./queue-tail";

interface DepartmentNodeData {
  department: DepartmentInfo;
  visits: VisitListItem[];
}

function DepartmentNodeComponent({ data }: NodeProps) {
  const { department, visits } = data as unknown as DepartmentNodeData;
  const statusColor = DEPARTMENT_STATUS_COLORS[department.status] || "#6b7280";
  const isCritical = department.status === "CRITICAL";
  const utilization = department.capacity > 0
    ? Math.round((department.current_patient_count / department.capacity) * 100)
    : 0;

  // Capacity ring: circumference of r=20 circle = 125.66
  const circumference = 125.66;
  const filled = (utilization / 100) * circumference;

  return (
    <div className="relative">
      <QueueTail visits={visits} />
      <Handle type="target" position={Position.Top} className="opacity-0" />
      <div
        className="rounded-xl border px-4 py-3 min-w-[160px] backdrop-blur-sm transition-all"
        style={{
          background: `${statusColor}08`,
          borderColor: `${statusColor}40`,
          boxShadow: isCritical ? `0 0 20px ${statusColor}30` : "none",
          animation: isCritical ? "pulse 1.5s ease-in-out infinite" : "none",
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-2 mb-2">
          <span className="text-sm font-bold font-mono" style={{ color: statusColor }}>
            {department.label}
          </span>
          <span
            className="text-[10px] font-mono px-1.5 py-0.5 rounded-full"
            style={{
              color: statusColor,
              background: `${statusColor}20`,
            }}
          >
            {department.status}
          </span>
        </div>

        {/* Capacity */}
        <div className="flex items-center gap-3">
          <svg width="44" height="44" className="flex-shrink-0">
            <circle
              cx="22" cy="22" r="20"
              fill="none"
              stroke={`${statusColor}20`}
              strokeWidth="3"
            />
            <circle
              cx="22" cy="22" r="20"
              fill="none"
              stroke={statusColor}
              strokeWidth="3"
              strokeDasharray={`${filled} ${circumference - filled}`}
              strokeLinecap="round"
              transform="rotate(-90 22 22)"
            />
            <text
              x="22" y="22"
              textAnchor="middle"
              dominantBaseline="central"
              fill={statusColor}
              fontSize="10"
              fontFamily="monospace"
            >
              {utilization}%
            </text>
          </svg>
          <div>
            <div className="text-xs font-mono" style={{ color: "#8b949e" }}>
              {department.current_patient_count}/{department.capacity} beds
            </div>
            {!department.is_open && (
              <div className="text-[10px] font-mono text-red-400 mt-0.5">CLOSED</div>
            )}
          </div>
        </div>
      </div>
      <Handle type="source" position={Position.Bottom} className="opacity-0" />
    </div>
  );
}

export const DepartmentNode = memo(DepartmentNodeComponent);
```

- [ ] **Step 4: Commit**

```bash
git add web/components/operations/canvas/patient-dot.tsx web/components/operations/canvas/queue-tail.tsx web/components/operations/canvas/department-node.tsx
git commit -m "feat: add DepartmentNode with queue tail and patient dots"
```

---

## Task 11: Custom Canvas Nodes — ReceptionNode & DischargeNode

**Files:**
- Create: `web/components/operations/canvas/reception-node.tsx`
- Create: `web/components/operations/canvas/discharge-node.tsx`

- [ ] **Step 1: Create ReceptionNode**

```typescript
// web/components/operations/canvas/reception-node.tsx
"use client";

import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import type { VisitListItem } from "@/lib/api";
import { QueueTail } from "./queue-tail";

interface ReceptionNodeData {
  visits: VisitListItem[];
}

function ReceptionNodeComponent({ data }: NodeProps) {
  const { visits } = data as unknown as ReceptionNodeData;

  const intakeCount = visits.filter((v) => v.status === "intake" || v.status === "triaged").length;
  const routingCount = visits.filter((v) => v.status === "auto_routed").length;
  const reviewCount = visits.filter((v) => v.status === "pending_review" || v.status === "routed").length;

  return (
    <div className="relative">
      <QueueTail visits={visits} />
      <div
        className="rounded-xl border px-6 py-4 min-w-[240px] backdrop-blur-sm"
        style={{
          background: "rgba(0, 217, 255, 0.06)",
          borderColor: "rgba(0, 217, 255, 0.4)",
          boxShadow: "0 0 15px rgba(0, 217, 255, 0.1)",
        }}
      >
        <div className="text-sm font-bold font-mono text-[#00d9ff] mb-2">
          RECEPTION
        </div>
        <div className="flex gap-3 text-[11px] font-mono">
          {intakeCount > 0 && (
            <span className="text-[#00d9ff]">{intakeCount} intake</span>
          )}
          {routingCount > 0 && (
            <span className="text-[#a78bfa]">{routingCount} routing</span>
          )}
          {reviewCount > 0 && (
            <span className="text-[#f59e0b]">{reviewCount} review</span>
          )}
          {visits.length === 0 && (
            <span className="text-[#8b949e]">No patients</span>
          )}
        </div>
      </div>
      <Handle type="source" position={Position.Bottom} className="opacity-0" />
    </div>
  );
}

export const ReceptionNode = memo(ReceptionNodeComponent);
```

- [ ] **Step 2: Create DischargeNode**

```typescript
// web/components/operations/canvas/discharge-node.tsx
"use client";

import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";

interface DischargeNodeData {
  count: number;
}

function DischargeNodeComponent({ data }: NodeProps) {
  const { count } = data as unknown as DischargeNodeData;

  return (
    <div className="relative">
      <Handle type="target" position={Position.Top} className="opacity-0" />
      <div
        className="rounded-xl border px-5 py-3 min-w-[140px] backdrop-blur-sm text-center"
        style={{
          background: "rgba(16, 185, 129, 0.06)",
          borderColor: "rgba(16, 185, 129, 0.3)",
        }}
      >
        <div className="text-sm font-bold font-mono text-[#10b981]">
          DISCHARGE
        </div>
        <div className="text-xs font-mono text-[#8b949e] mt-1">
          {count} today
        </div>
      </div>
    </div>
  );
}

export const DischargeNode = memo(DischargeNodeComponent);
```

- [ ] **Step 3: Commit**

```bash
git add web/components/operations/canvas/reception-node.tsx web/components/operations/canvas/discharge-node.tsx
git commit -m "feat: add ReceptionNode and DischargeNode canvas components"
```

---

## Task 12: Patient Popover & Custom Edges

**Files:**
- Create: `web/components/operations/canvas/patient-popover.tsx`
- Create: `web/components/operations/canvas/flow-edge.tsx`
- Create: `web/components/operations/canvas/transfer-edge.tsx`

- [ ] **Step 1: Create PatientPopover**

```typescript
// web/components/operations/canvas/patient-popover.tsx
"use client";

import { useEffect, useRef } from "react";
import type { VisitListItem } from "@/lib/api";
import { formatTimeAgo, getWaitTimeColor } from "../operations-constants";

interface PatientPopoverProps {
  visit: VisitListItem;
  onClose: () => void;
}

export function PatientPopover({ visit, onClose }: PatientPopoverProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onClose]);

  const waitColor = getWaitTimeColor(visit.created_at);

  return (
    <div
      ref={ref}
      className="absolute z-50 left-1/2 -translate-x-1/2 bottom-full mb-2 rounded-lg border px-3 py-2 min-w-[200px] shadow-xl"
      style={{
        background: "#161b22",
        borderColor: "rgba(255,255,255,0.1)",
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between gap-2 mb-1">
        <span className="text-sm font-semibold text-white">{visit.patient_name}</span>
        <span
          className="w-2 h-2 rounded-full"
          style={{ backgroundColor: waitColor }}
        />
      </div>
      <div className="text-[10px] font-mono text-[#8b949e] mb-1">{visit.visit_id}</div>
      {visit.chief_complaint && (
        <p className="text-xs text-[#c9d1d9] line-clamp-2 mb-1">{visit.chief_complaint}</p>
      )}
      <div className="flex items-center justify-between text-[10px] font-mono">
        <span style={{ color: waitColor }}>{formatTimeAgo(visit.created_at)}</span>
        <span className="text-[#8b949e] capitalize">{visit.status.replace("_", " ")}</span>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create FlowEdge**

```typescript
// web/components/operations/canvas/flow-edge.tsx
"use client";

import { memo } from "react";
import { BaseEdge, getStraightPath, type EdgeProps } from "@xyflow/react";

function FlowEdgeComponent(props: EdgeProps) {
  const { sourceX, sourceY, targetX, targetY, data } = props;
  const opacity = (data?.opacity as number) ?? 0.1;

  const [edgePath] = getStraightPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
  });

  return (
    <BaseEdge
      {...props}
      path={edgePath}
      style={{
        stroke: "rgba(0, 217, 255, 0.3)",
        strokeWidth: 1.5,
        strokeDasharray: "6 4",
        opacity,
      }}
    />
  );
}

export const FlowEdge = memo(FlowEdgeComponent);
```

- [ ] **Step 3: Create TransferEdge**

```typescript
// web/components/operations/canvas/transfer-edge.tsx
"use client";

import { memo } from "react";
import { BaseEdge, getSmoothStepPath, type EdgeProps } from "@xyflow/react";

function TransferEdgeComponent(props: EdgeProps) {
  const { sourceX, sourceY, targetX, targetY } = props;

  const [edgePath] = getSmoothStepPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    borderRadius: 16,
  });

  return (
    <BaseEdge
      {...props}
      path={edgePath}
      style={{
        stroke: "#f59e0b",
        strokeWidth: 2,
        animation: "edgeGlow 1s ease-out forwards",
      }}
    />
  );
}

export const TransferEdge = memo(TransferEdgeComponent);
```

- [ ] **Step 4: Commit**

```bash
git add web/components/operations/canvas/patient-popover.tsx web/components/operations/canvas/flow-edge.tsx web/components/operations/canvas/transfer-edge.tsx
git commit -m "feat: add patient popover and custom edge components"
```

---

## Task 13: KPI Bar Component

**Files:**
- Create: `web/components/operations/kpi-bar.tsx`

- [ ] **Step 1: Create KPI bar**

```typescript
// web/components/operations/kpi-bar.tsx
"use client";

import type { HospitalStats } from "@/lib/api";
import { Activity, AlertTriangle, Clock, LogOut } from "lucide-react";

interface KpiBarProps {
  stats: HospitalStats;
}

const KPI_ITEMS = [
  {
    key: "active_patients" as const,
    label: "Active Patients",
    icon: Activity,
    color: "#00d9ff",
  },
  {
    key: "departments_at_capacity" as const,
    label: "At Capacity",
    icon: AlertTriangle,
    color: "#ef4444",
  },
  {
    key: "avg_wait_minutes" as const,
    label: "Avg Wait",
    icon: Clock,
    color: "#f59e0b",
    format: (v: number) => `${v.toFixed(0)}m`,
  },
  {
    key: "discharged_today" as const,
    label: "Discharged Today",
    icon: LogOut,
    color: "#10b981",
  },
];

export function KpiBar({ stats }: KpiBarProps) {
  return (
    <div className="flex items-center gap-3 px-4 py-2 border-b" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
      {KPI_ITEMS.map((item) => {
        const Icon = item.icon;
        const value = stats[item.key];
        const formatted = item.format ? item.format(value) : String(value);

        return (
          <div
            key={item.key}
            className="flex items-center gap-2 rounded-lg px-3 py-1.5"
            style={{ background: `${item.color}08`, border: `1px solid ${item.color}20` }}
          >
            <Icon size={14} style={{ color: item.color }} />
            <span className="text-sm font-bold font-mono" style={{ color: item.color }}>
              {formatted}
            </span>
            <span className="text-[10px] font-mono text-[#8b949e]">{item.label}</span>
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add web/components/operations/kpi-bar.tsx
git commit -m "feat: add KPI bar component for hospital stats"
```

---

## Task 14: Hospital Canvas Main Component

**Files:**
- Create: `web/components/operations/hospital-canvas.tsx`

- [ ] **Step 1: Create the main canvas wrapper**

```typescript
// web/components/operations/hospital-canvas.tsx
"use client";

import { useCallback, useMemo } from "react";
import {
  ReactFlow,
  Controls,
  MiniMap,
  Background,
  BackgroundVariant,
  type NodeTypes,
  type EdgeTypes,
  type OnNodesChange,
  type NodeDragHandler,
  useNodesState,
  useEdgesState,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { ReceptionNode } from "./canvas/reception-node";
import { DepartmentNode } from "./canvas/department-node";
import { DischargeNode } from "./canvas/discharge-node";
import { FlowEdge } from "./canvas/flow-edge";
import { TransferEdge } from "./canvas/transfer-edge";
import { onNodeDragStop } from "./use-hospital-canvas";
import type { Node, Edge } from "@xyflow/react";

const nodeTypes: NodeTypes = {
  reception: ReceptionNode,
  department: DepartmentNode,
  discharge: DischargeNode,
};

const edgeTypes: EdgeTypes = {
  flow: FlowEdge,
  transfer: TransferEdge,
};

interface HospitalCanvasProps {
  initialNodes: Node[];
  initialEdges: Edge[];
  onNodeClick?: (nodeId: string) => void;
}

export function HospitalCanvas({ initialNodes, initialEdges, onNodeClick }: HospitalCanvasProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  // Sync when data updates from polling
  useMemo(() => {
    setNodes(initialNodes);
    setEdges(initialEdges);
  }, [initialNodes, initialEdges, setNodes, setEdges]);

  const handleNodeDragStop: NodeDragHandler = useCallback((_event, node) => {
    onNodeDragStop(node.id, node.position);
  }, []);

  const handleNodeClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      onNodeClick?.(node.id);
    },
    [onNodeClick]
  );

  return (
    <div className="w-full h-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeDragStop={handleNodeDragStop}
        onNodeClick={handleNodeClick}
        fitView
        minZoom={0.3}
        maxZoom={1.5}
        proOptions={{ hideAttribution: true }}
      >
        <Controls
          position="bottom-right"
          style={{ background: "#161b22", borderColor: "rgba(255,255,255,0.1)" }}
        />
        <MiniMap
          position="bottom-left"
          nodeColor={(node) => {
            if (node.type === "reception") return "#00d9ff";
            if (node.type === "discharge") return "#10b981";
            return (node.data as any)?.department?.color || "#6366f1";
          }}
          style={{ background: "#0d1117", borderColor: "rgba(255,255,255,0.06)" }}
        />
        <Background variant={BackgroundVariant.Dots} color="rgba(0,217,255,0.05)" gap={40} />
      </ReactFlow>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd web && npx tsc --noEmit`
Expected: No errors (or only pre-existing)

- [ ] **Step 3: Commit**

```bash
git add web/components/operations/hospital-canvas.tsx
git commit -m "feat: add HospitalCanvas main component with xyflow"
```

---

## Task 15: Operations Dialogs

**Files:**
- Create: `web/components/operations/dialogs/reception-dialog.tsx`
- Create: `web/components/operations/dialogs/department-dialog.tsx`
- Move: pipeline detail files to operations/dialogs/

- [ ] **Step 1: Move existing detail components**

```bash
mkdir -p web/components/operations/dialogs
cp web/components/pipeline/intake-detail.tsx web/components/operations/dialogs/
cp web/components/pipeline/review-detail.tsx web/components/operations/dialogs/
cp web/components/pipeline/routed-detail.tsx web/components/operations/dialogs/
cp web/components/pipeline/department-detail.tsx web/components/operations/dialogs/
```

Update import paths in the copied files as needed (replace `./pipeline-constants` with `../operations-constants`).

- [ ] **Step 2: Create ReceptionDialog**

```typescript
// web/components/operations/dialogs/reception-dialog.tsx
"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { VisitListItem } from "@/lib/api";
import { formatTimeAgo } from "../operations-constants";

interface ReceptionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  visits: VisitListItem[];
  onVisitUpdated: () => void;
}

type Tab = "intake" | "routing" | "review";

const TABS: { id: Tab; label: string; statuses: string[] }[] = [
  { id: "intake", label: "Intake", statuses: ["intake", "triaged"] },
  { id: "routing", label: "Routing", statuses: ["auto_routed"] },
  { id: "review", label: "Review", statuses: ["pending_review", "routed"] },
];

export function ReceptionDialog({ open, onOpenChange, visits, onVisitUpdated }: ReceptionDialogProps) {
  const [activeTab, setActiveTab] = useState<Tab>("intake");

  const filteredVisits = visits.filter((v) =>
    TABS.find((t) => t.id === activeTab)?.statuses.includes(v.status)
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col bg-[#161b22] border-[rgba(255,255,255,0.06)]">
        <DialogHeader>
          <DialogTitle className="text-[#00d9ff] font-mono">Reception</DialogTitle>
        </DialogHeader>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-[rgba(255,255,255,0.06)] pb-2">
          {TABS.map((tab) => {
            const count = visits.filter((v) => tab.statuses.includes(v.status)).length;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-3 py-1.5 rounded-md text-xs font-mono transition-colors ${
                  activeTab === tab.id
                    ? "bg-[rgba(0,217,255,0.1)] text-[#00d9ff]"
                    : "text-[#8b949e] hover:text-white"
                }`}
              >
                {tab.label} ({count})
              </button>
            );
          })}
        </div>

        {/* Visit List */}
        <div className="flex-1 overflow-y-auto space-y-2 py-2">
          {filteredVisits.length === 0 && (
            <p className="text-center text-[#8b949e] text-sm py-8">No patients in this stage</p>
          )}
          {filteredVisits.map((visit) => (
            <div
              key={visit.id}
              className="rounded-lg border px-3 py-2 cursor-pointer hover:border-[rgba(0,217,255,0.3)] transition-colors"
              style={{
                background: "rgba(255,255,255,0.02)",
                borderColor: "rgba(255,255,255,0.06)",
              }}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-white">{visit.patient_name}</span>
                <span className="text-[10px] font-mono text-[#8b949e]">
                  {formatTimeAgo(visit.created_at)}
                </span>
              </div>
              {visit.chief_complaint && (
                <p className="text-xs text-[#8b949e] mt-1 line-clamp-1">{visit.chief_complaint}</p>
              )}
              <div className="text-[10px] font-mono text-[#6b7280] mt-1">
                {visit.visit_id} · {visit.status.replace("_", " ")}
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 3: Create DepartmentDialog**

```typescript
// web/components/operations/dialogs/department-dialog.tsx
"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { DepartmentInfo, VisitListItem } from "@/lib/api";
import { updateDepartment } from "@/lib/api";
import { formatTimeAgo, getWaitTimeColor } from "../operations-constants";

interface DepartmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  department: DepartmentInfo | null;
  visits: VisitListItem[];
  onUpdated: () => void;
}

export function DepartmentDialog({ open, onOpenChange, department, visits, onUpdated }: DepartmentDialogProps) {
  const [capacity, setCapacity] = useState(department?.capacity ?? 3);
  const [saving, setSaving] = useState(false);

  if (!department) return null;

  const handleToggleOpen = async () => {
    setSaving(true);
    try {
      await updateDepartment(department.name, { is_open: !department.is_open });
      onUpdated();
    } finally {
      setSaving(false);
    }
  };

  const handleSaveCapacity = async () => {
    setSaving(true);
    try {
      await updateDepartment(department.name, { capacity });
      onUpdated();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-hidden flex flex-col bg-[#161b22] border-[rgba(255,255,255,0.06)]">
        <DialogHeader>
          <DialogTitle className="font-mono" style={{ color: department.color }}>
            {department.label}
          </DialogTitle>
        </DialogHeader>

        {/* Settings */}
        <div className="flex items-center gap-4 py-2 border-b border-[rgba(255,255,255,0.06)]">
          <div className="flex items-center gap-2">
            <label className="text-xs font-mono text-[#8b949e]">Capacity:</label>
            <input
              type="number"
              min={1}
              max={20}
              value={capacity}
              onChange={(e) => setCapacity(Number(e.target.value))}
              className="w-14 rounded bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.1)] px-2 py-1 text-xs font-mono text-white"
            />
            <button
              onClick={handleSaveCapacity}
              disabled={saving || capacity === department.capacity}
              className="text-xs font-mono px-2 py-1 rounded bg-[rgba(0,217,255,0.1)] text-[#00d9ff] hover:bg-[rgba(0,217,255,0.2)] disabled:opacity-40"
            >
              Save
            </button>
          </div>
          <button
            onClick={handleToggleOpen}
            disabled={saving}
            className={`text-xs font-mono px-2 py-1 rounded ${
              department.is_open
                ? "bg-[rgba(239,68,68,0.1)] text-red-400 hover:bg-[rgba(239,68,68,0.2)]"
                : "bg-[rgba(16,185,129,0.1)] text-emerald-400 hover:bg-[rgba(16,185,129,0.2)]"
            }`}
          >
            {department.is_open ? "Close Dept" : "Open Dept"}
          </button>
        </div>

        {/* Patient Queue */}
        <div className="flex-1 overflow-y-auto space-y-2 py-2">
          <div className="text-xs font-mono text-[#8b949e] mb-1">
            Patient Queue ({visits.length})
          </div>
          {visits.length === 0 && (
            <p className="text-center text-[#8b949e] text-sm py-6">No patients</p>
          )}
          {visits.map((visit) => {
            const waitColor = getWaitTimeColor(visit.created_at);
            return (
              <div
                key={visit.id}
                className="rounded-lg border px-3 py-2"
                style={{
                  background: "rgba(255,255,255,0.02)",
                  borderColor: "rgba(255,255,255,0.06)",
                }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: waitColor }}
                    />
                    <span className="text-sm font-semibold text-white">{visit.patient_name}</span>
                  </div>
                  <span className="text-[10px] font-mono" style={{ color: waitColor }}>
                    {formatTimeAgo(visit.created_at)}
                  </span>
                </div>
                {visit.chief_complaint && (
                  <p className="text-xs text-[#8b949e] mt-1 line-clamp-1 ml-4">{visit.chief_complaint}</p>
                )}
              </div>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add web/components/operations/dialogs/
git commit -m "feat: add reception and department dialogs with patient queue"
```

---

## Task 16: Operations Page & Navigation

**Files:**
- Create: `web/app/(dashboard)/operations/page.tsx`
- Modify: `web/components/sidebar.tsx`
- Remove: `web/app/(dashboard)/pipeline/page.tsx`
- Remove: `web/components/pipeline/kanban-board.tsx`
- Remove: `web/components/pipeline/kanban-column.tsx`
- Remove: `web/components/pipeline/visit-card.tsx`
- Remove: `web/components/pipeline/detail-panel.tsx`
- Remove: `web/components/pipeline/pipeline-constants.ts`

- [ ] **Step 1: Create the operations page**

```typescript
// web/app/(dashboard)/operations/page.tsx
"use client";

import { useCallback, useState } from "react";
import { useHospitalCanvas } from "@/components/operations/use-hospital-canvas";
import { HospitalCanvas } from "@/components/operations/hospital-canvas";
import { KpiBar } from "@/components/operations/kpi-bar";
import { ReceptionDialog } from "@/components/operations/dialogs/reception-dialog";
import { DepartmentDialog } from "@/components/operations/dialogs/department-dialog";

export default function OperationsPage() {
  const { nodes, edges, stats, departments, receptionVisits, departmentVisits, loading, error, refresh } =
    useHospitalCanvas();
  const [receptionOpen, setReceptionOpen] = useState(false);
  const [selectedDept, setSelectedDept] = useState<string | null>(null);

  const handleNodeClick = useCallback(
    (nodeId: string) => {
      if (nodeId === "reception") {
        setReceptionOpen(true);
      } else if (nodeId !== "discharge") {
        setSelectedDept(nodeId);
      }
    },
    []
  );

  const selectedDepartment = departments.find((d) => d.name === selectedDept) ?? null;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-[#8b949e] font-mono text-sm">Loading hospital data...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-red-400 font-mono text-sm">{error}</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <KpiBar stats={stats} />
      <div className="flex-1 min-h-0">
        <HospitalCanvas
          initialNodes={nodes}
          initialEdges={edges}
          onNodeClick={handleNodeClick}
        />
      </div>

      <ReceptionDialog
        open={receptionOpen}
        onOpenChange={setReceptionOpen}
        visits={receptionVisits}
        onVisitUpdated={refresh}
      />

      <DepartmentDialog
        open={!!selectedDept}
        onOpenChange={(open) => !open && setSelectedDept(null)}
        department={selectedDepartment}
        visits={selectedDept ? (departmentVisits[selectedDept] ?? []) : []}
        onUpdated={refresh}
      />
    </div>
  );
}
```

- [ ] **Step 2: Update sidebar navigation**

In `web/components/sidebar.tsx`, change the Pipeline nav item:

Replace:
```typescript
{ href: "/pipeline", icon: Workflow, label: "Pipeline" }
```

With:
```typescript
{ href: "/operations", icon: Monitor, label: "Operations" }
```

Add `Monitor` to the lucide-react imports.

- [ ] **Step 3: Remove old pipeline files**

```bash
rm web/app/\(dashboard\)/pipeline/page.tsx
rm web/components/pipeline/kanban-board.tsx
rm web/components/pipeline/kanban-column.tsx
rm web/components/pipeline/visit-card.tsx
rm web/components/pipeline/detail-panel.tsx
rm web/components/pipeline/pipeline-constants.ts
```

- [ ] **Step 4: Verify the app builds**

Run: `cd web && npm run build`
Expected: Build succeeds with no errors

- [ ] **Step 5: Commit**

```bash
git add web/app/\(dashboard\)/operations/ web/components/sidebar.tsx
git add -u  # stages deletions
git commit -m "feat: add operations page, update sidebar, remove old pipeline"
```

---

## Task 17: Drag-and-Drop Patient Transfer

**Files:**
- Modify: `web/components/operations/canvas/patient-dot.tsx`
- Modify: `web/components/operations/canvas/department-node.tsx`
- Modify: `web/components/operations/hospital-canvas.tsx`

- [ ] **Step 1: Make PatientDot draggable**

Update `web/components/operations/canvas/patient-dot.tsx` to support drag:

```typescript
// Add to PatientDot component
const handleDragStart = (e: React.DragEvent) => {
  e.dataTransfer.setData("application/visit-id", String(visit.id));
  e.dataTransfer.setData("application/source-dept", visit.current_department || "");
  e.dataTransfer.effectAllowed = "move";
};
```

Add `draggable` and `onDragStart={handleDragStart}` to the button element. Add a prop `draggable?: boolean` to `PatientDotProps` (only enable drag for department patients, not reception).

- [ ] **Step 2: Make DepartmentNode a drop target**

Update `web/components/operations/canvas/department-node.tsx`:

Add an `onTransfer` callback prop to the node data interface:

```typescript
interface DepartmentNodeData {
  department: DepartmentInfo;
  visits: VisitListItem[];
  onTransfer?: (visitId: number, targetDept: string) => void;
}
```

Add drag-over and drop handlers to the outer div:

```typescript
const [dragOver, setDragOver] = useState(false);

const handleDragOver = (e: React.DragEvent) => {
  e.preventDefault();
  const sourceDept = e.dataTransfer.types.includes("application/source-dept");
  if (sourceDept && department.is_open) {
    e.dataTransfer.dropEffect = "move";
    setDragOver(true);
  }
};

const handleDragLeave = () => setDragOver(false);

const handleDrop = (e: React.DragEvent) => {
  e.preventDefault();
  setDragOver(false);
  const visitId = Number(e.dataTransfer.getData("application/visit-id"));
  if (visitId && data.onTransfer) {
    data.onTransfer(visitId, department.name);
  }
};
```

Apply `onDragOver={handleDragOver}`, `onDragLeave={handleDragLeave}`, `onDrop={handleDrop}` to the outer div. When `dragOver` is true, add a glow border: `borderColor: dragOver ? department.color : ...`. Closed departments should ignore drops.

- [ ] **Step 3: Wire up transfer in HospitalCanvas**

In `web/components/operations/hospital-canvas.tsx`, add a `handleTransfer` callback:

```typescript
import { transferVisit } from "@/lib/api";
import { toast } from "sonner"; // or your toast library

interface HospitalCanvasProps {
  initialNodes: Node[];
  initialEdges: Edge[];
  onNodeClick?: (nodeId: string) => void;
  onRefresh?: () => void;
}

const handleTransfer = useCallback(async (visitId: number, targetDept: string) => {
  try {
    await transferVisit(visitId, targetDept);
    onRefresh?.();
  } catch (err) {
    toast.error(err instanceof Error ? err.message : "Transfer failed");
    onRefresh?.(); // snap back by re-fetching
  }
}, [onRefresh]);
```

Pass `onTransfer: handleTransfer` into department node data when building nodes. This needs to be done in `use-hospital-canvas.ts` — add `onTransfer` as a param to `buildNodes` and pass it into each department node's `data`.

- [ ] **Step 4: Pass onTransfer through the data flow**

In `use-hospital-canvas.ts`, update `buildNodes` signature to accept `onTransfer`:

```typescript
function buildNodes(
  departments: DepartmentInfo[],
  visits: VisitListItem[],
  positions: Record<string, { x: number; y: number }>,
  onTransfer?: (visitId: number, targetDept: string) => void,
): Node[]
```

And for each department node:
```typescript
data: {
  department: dept,
  visits: departmentVisits[dept.name] || [],
  onTransfer,
},
```

Also add `onTransfer` to the `CanvasData` return type so `HospitalCanvas` can pass it through. Add `onRefresh` (alias of `refresh`) to the returned data.

- [ ] **Step 5: Commit**

```bash
git add web/components/operations/
git commit -m "feat: add drag-and-drop patient transfer between departments"
```

---

## Task 18: Right-Click Context Menu & Patient Detail Dialog

**Files:**
- Modify: `web/components/operations/canvas/department-node.tsx`
- Create: `web/components/operations/dialogs/patient-detail-dialog.tsx`

- [ ] **Step 1: Add right-click context menu to DepartmentNode**

Add a simple context menu to `department-node.tsx`:

```typescript
const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);

const handleContextMenu = (e: React.MouseEvent) => {
  e.preventDefault();
  e.stopPropagation();
  setContextMenu({ x: e.clientX, y: e.clientY });
};
```

Add `onContextMenu={handleContextMenu}` to the outer div. Render a dropdown:

```typescript
{contextMenu && (
  <div
    className="fixed z-50 rounded-lg border shadow-xl py-1 min-w-[150px]"
    style={{
      left: contextMenu.x,
      top: contextMenu.y,
      background: "#161b22",
      borderColor: "rgba(255,255,255,0.1)",
    }}
  >
    <button
      className="w-full text-left px-3 py-1.5 text-xs font-mono text-[#8b949e] hover:bg-[rgba(255,255,255,0.05)] hover:text-white"
      onClick={() => { data.onToggleOpen?.(department.name); setContextMenu(null); }}
    >
      {department.is_open ? "Close Department" : "Open Department"}
    </button>
    <button
      className="w-full text-left px-3 py-1.5 text-xs font-mono text-[#8b949e] hover:bg-[rgba(255,255,255,0.05)] hover:text-white"
      onClick={() => { data.onSetCapacity?.(department.name); setContextMenu(null); }}
    >
      Set Capacity
    </button>
  </div>
)}
```

Add a click-outside handler to dismiss. Pass `onToggleOpen` and `onSetCapacity` callbacks through node data.

- [ ] **Step 2: Create PatientDetailDialog**

```typescript
// web/components/operations/dialogs/patient-detail-dialog.tsx
"use client";

import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { getVisit, type VisitDetail } from "@/lib/api";
import { formatTimeAgo, getWaitTimeColor } from "../operations-constants";

interface PatientDetailDialogProps {
  visitId: number | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PatientDetailDialog({ visitId, open, onOpenChange }: PatientDetailDialogProps) {
  const [visit, setVisit] = useState<VisitDetail | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!visitId || !open) return;
    setLoading(true);
    getVisit(visitId)
      .then(setVisit)
      .finally(() => setLoading(false));
  }, [visitId, open]);

  if (!visit && !loading) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-[#161b22] border-[rgba(255,255,255,0.06)]">
        <DialogHeader>
          <DialogTitle className="text-white font-mono">
            {loading ? "Loading..." : visit?.patient_name}
          </DialogTitle>
        </DialogHeader>
        {visit && (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-[#8b949e]">{visit.visit_id}</span>
              <span style={{ color: getWaitTimeColor(visit.created_at) }}>
                {formatTimeAgo(visit.created_at)}
              </span>
            </div>
            <div className="text-xs text-[#8b949e]">
              <span>{visit.patient_dob}</span> · <span className="capitalize">{visit.patient_gender}</span>
            </div>
            {visit.chief_complaint && (
              <div>
                <div className="text-[10px] font-mono text-[#6b7280] mb-1">Chief Complaint</div>
                <p className="text-sm text-[#c9d1d9]">{visit.chief_complaint}</p>
              </div>
            )}
            {visit.intake_notes && (
              <div>
                <div className="text-[10px] font-mono text-[#6b7280] mb-1">Intake Notes</div>
                <p className="text-sm text-[#c9d1d9] whitespace-pre-wrap">{visit.intake_notes}</p>
              </div>
            )}
            <div className="flex items-center gap-2 text-xs font-mono">
              <span className="text-[#8b949e]">Status:</span>
              <span className="text-white capitalize">{visit.status.replace("_", " ")}</span>
            </div>
            {visit.current_department && (
              <div className="flex items-center gap-2 text-xs font-mono">
                <span className="text-[#8b949e]">Department:</span>
                <span className="text-white capitalize">{visit.current_department.replace("_", " ")}</span>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 3: Wire "View Details" in PatientPopover**

Update `patient-popover.tsx` to accept an `onViewDetails` callback and add a link:

```typescript
<button
  onClick={() => onViewDetails?.(visit.id)}
  className="text-[10px] font-mono text-[#00d9ff] hover:underline mt-1"
>
  View Details →
</button>
```

Wire this through the operations page state to open `PatientDetailDialog`.

- [ ] **Step 4: Commit**

```bash
git add web/components/operations/
git commit -m "feat: add right-click context menu and patient detail dialog"
```

---

## Task 19: CSS Animations & Polish

**Files:**
- Modify: `web/app/globals.css`
- Modify: `web/components/operations/canvas/patient-dot.tsx`

- [ ] **Step 1: Add canvas-specific CSS animations**

Add to `web/app/globals.css`:

```css
/* Hospital canvas animations */
@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.6; }
}

@keyframes edgeGlow {
  0% { opacity: 1; stroke-width: 3; }
  100% { opacity: 0; stroke-width: 1; }
}

/* Patient dot entrance animation */
@keyframes dotFadeIn {
  from { opacity: 0; transform: scale(0); }
  to { opacity: 1; transform: scale(1); }
}

/* Xyflow overrides for dark theme */
.react-flow__controls button {
  background: #161b22 !important;
  border-color: rgba(255, 255, 255, 0.1) !important;
  color: #8b949e !important;
}

.react-flow__controls button:hover {
  background: #1c2128 !important;
}

.react-flow__minimap {
  background: #0d1117 !important;
}
```

- [ ] **Step 1b: Apply dotFadeIn animation to PatientDot**

In `web/components/operations/canvas/patient-dot.tsx`, add `animation: "dotFadeIn 0.3s ease-out"` to the button style object (alongside the existing `pulse` animation). Use a comma-separated animation value:

```typescript
animation: `dotFadeIn 0.3s ease-out, pulse 2s ease-in-out 0.3s infinite`,
```

- [ ] **Step 2: Verify visually in browser**

Run: `cd web && npm run dev`

Open http://localhost:3000/operations and verify:
- All 14 department nodes render with correct colors
- Reception node shows at top center
- Discharge node shows at bottom center
- KPI bar displays stats
- Nodes are draggable
- Clicking nodes opens dialogs
- MiniMap and controls work

- [ ] **Step 3: Commit**

```bash
git add web/
git commit -m "feat: add canvas animations and dark theme overrides"
```

---

## Task 20: End-to-End Verification

- [ ] **Step 1: Run all backend tests**

Run: `pytest tests/ -v`
Expected: All tests pass

- [ ] **Step 2: Run frontend type check**

Run: `cd web && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Run frontend build**

Run: `cd web && npm run build`
Expected: Build succeeds

- [ ] **Step 4: Manual smoke test**

1. Start backend: `python -m uvicorn src.api.server:app --reload`
2. Start frontend: `cd web && npm run dev`
3. Open http://localhost:3000/operations
4. Verify: 14 departments + Reception + Discharge visible
5. Verify: KPI bar shows stats
6. Click Reception → dialog opens with tabs
7. Click a department → dialog opens with queue and settings
8. Drag a node → position persists on reload

- [ ] **Step 5: Run GitNexus detect_changes**

Run: `npx gitnexus analyze` then verify changes match expected scope.

- [ ] **Step 6: Final commit if any remaining changes**

```bash
git add -A
git commit -m "chore: final polish for hospital operations canvas"
```
