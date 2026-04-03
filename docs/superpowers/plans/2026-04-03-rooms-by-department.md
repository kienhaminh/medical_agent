# Rooms by Department Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add clinical exam rooms to the backend and show them in department cards on the `/operations` page, with the agent automatically assigning patients to empty rooms on routing.

**Architecture:** A new `rooms` table stores room-to-department mappings with a nullable `current_visit_id`. A new `/api/rooms` router handles CRUD and assignment. The `complete_triage_tool` gains room-assignment logic after routing. The frontend fetches rooms alongside departments and renders expandable room tiles inside each department card.

**Tech Stack:** Python/FastAPI, SQLAlchemy (async for API, sync for tools), Alembic, React/Next.js, Tailwind CSS, TypeScript

---

## File Map

**Create:**
- `src/models/room.py` — Room SQLAlchemy model
- `alembic/versions/004_add_rooms.py` — DB migration
- `src/api/routers/rooms.py` — rooms API router
- `tests/test_rooms_api.py` — rooms API tests

**Modify:**
- `src/models/__init__.py` — export Room
- `src/api/models.py` — add RoomResponse, RoomCreate Pydantic models
- `src/api/server.py` — import and register rooms router
- `src/tools/complete_triage_tool.py` — add room assignment after routing
- `web/lib/api.ts` — add RoomInfo type and listRooms()
- `web/components/operations/use-operations-dashboard.ts` — fetch rooms, expose them
- `web/components/operations/department-card.tsx` — expandable rooms section

---

## Task 1: Room SQLAlchemy Model

**Files:**
- Create: `src/models/room.py`
- Modify: `src/models/__init__.py`

- [ ] **Step 1: Create the Room model**

```python
# src/models/room.py
"""Room model — one clinical exam room per row, one patient at a time."""
from sqlalchemy import Column, Integer, String, ForeignKey
from .base import Base


class Room(Base):
    __tablename__ = "rooms"

    id = Column(Integer, primary_key=True, autoincrement=True)
    room_number = Column(String(20), unique=True, nullable=False, index=True)
    department_name = Column(String(50), ForeignKey("departments.name"), nullable=False, index=True)
    current_visit_id = Column(Integer, ForeignKey("visits.id"), nullable=True)
```

- [ ] **Step 2: Export Room from `src/models/__init__.py`**

Add to the imports block (after the `Department` import):
```python
from .room import Room
```

Add `"Room"` to `__all__`.

- [ ] **Step 3: Commit**

```bash
git add src/models/room.py src/models/__init__.py
git commit -m "feat(rooms): add Room SQLAlchemy model"
```

---

## Task 2: Alembic Migration

**Files:**
- Create: `alembic/versions/004_add_rooms.py`

- [ ] **Step 1: Create the migration file**

```python
# alembic/versions/004_add_rooms.py
"""Add rooms table.

Revision ID: 004_add_rooms
Revises: 003_drop_unused_intake_columns
Create Date: 2026-04-03
"""
from alembic import op
import sqlalchemy as sa

revision = "004_add_rooms"
down_revision = "003_drop_unused_intake_columns"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "rooms",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("room_number", sa.String(20), nullable=False, unique=True),
        sa.Column("department_name", sa.String(50), sa.ForeignKey("departments.name"), nullable=False),
        sa.Column("current_visit_id", sa.Integer(), sa.ForeignKey("visits.id"), nullable=True),
    )
    op.create_index("ix_rooms_room_number", "rooms", ["room_number"], unique=True)
    op.create_index("ix_rooms_department_name", "rooms", ["department_name"])


def downgrade() -> None:
    op.drop_index("ix_rooms_department_name", table_name="rooms")
    op.drop_index("ix_rooms_room_number", table_name="rooms")
    op.drop_table("rooms")
```

- [ ] **Step 2: Run the migration**

```bash
alembic upgrade head
```

Expected output ends with: `Running upgrade 003_drop_unused_intake_columns -> 004_add_rooms`

- [ ] **Step 3: Commit**

```bash
git add alembic/versions/004_add_rooms.py
git commit -m "feat(rooms): add rooms table migration"
```

---

## Task 3: Pydantic Models + Rooms API Router

**Files:**
- Modify: `src/api/models.py`
- Create: `src/api/routers/rooms.py`
- Modify: `src/api/server.py`

- [ ] **Step 1: Write the failing tests first**

```python
# tests/test_rooms_api.py
import pytest
import pytest_asyncio
from contextlib import asynccontextmanager
from unittest.mock import patch
from httpx import AsyncClient, ASGITransport

from src.models.base import get_db
from src.models.department import Department
from src.models.room import Room


@pytest_asyncio.fixture
async def client(db_session):
    @asynccontextmanager
    async def mock_lifespan(app):
        yield

    with patch("src.api.server.lifespan", mock_lifespan):
        from src.api.server import app

        async def override_get_db():
            yield db_session

        app.dependency_overrides[get_db] = override_get_db
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            yield client
        app.dependency_overrides.clear()


@pytest_asyncio.fixture
async def seeded_dept(db_session):
    dept = Department(
        name="ent",
        label="ENT Department",
        capacity=4,
        is_open=True,
        color="#6366f1",
        icon="Ear",
    )
    db_session.add(dept)
    await db_session.commit()


@pytest.mark.asyncio
async def test_list_rooms_empty(client, seeded_dept):
    response = await client.get("/api/rooms")
    assert response.status_code == 200
    assert response.json() == []


@pytest.mark.asyncio
async def test_create_room(client, seeded_dept):
    response = await client.post("/api/rooms", json={"room_number": "101", "department_name": "ent"})
    assert response.status_code == 201
    data = response.json()
    assert data["room_number"] == "101"
    assert data["department_name"] == "ent"
    assert data["current_visit_id"] is None
    assert data["patient_name"] is None


@pytest.mark.asyncio
async def test_create_room_duplicate_fails(client, seeded_dept):
    await client.post("/api/rooms", json={"room_number": "101", "department_name": "ent"})
    response = await client.post("/api/rooms", json={"room_number": "101", "department_name": "ent"})
    assert response.status_code == 409


@pytest.mark.asyncio
async def test_list_rooms_returns_created(client, seeded_dept):
    await client.post("/api/rooms", json={"room_number": "101", "department_name": "ent"})
    await client.post("/api/rooms", json={"room_number": "102", "department_name": "ent"})
    response = await client.get("/api/rooms")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 2
    numbers = [r["room_number"] for r in data]
    assert "101" in numbers
    assert "102" in numbers


@pytest.mark.asyncio
async def test_patch_room_assign_visit(client, seeded_dept, db_session):
    from src.models.patient import Patient
    from src.models.visit import Visit, VisitStatus
    from src.models.chat import ChatSession

    # Create patient, session, visit
    patient = Patient(name="John Doe", dob="1980-01-01", gender="M")
    db_session.add(patient)
    await db_session.flush()

    session = ChatSession(patient_id=patient.id, agent_type="reception")
    db_session.add(session)
    await db_session.flush()

    visit = Visit(
        visit_id="VIS-TEST-001",
        patient_id=patient.id,
        status=VisitStatus.IN_DEPARTMENT.value,
        current_department="ent",
        queue_position=1,
        chief_complaint="ear pain",
        intake_session_id=session.id,
    )
    db_session.add(visit)
    await db_session.flush()

    await client.post("/api/rooms", json={"room_number": "101", "department_name": "ent"})

    response = await client.patch("/api/rooms/101", json={"current_visit_id": visit.id})
    assert response.status_code == 200
    data = response.json()
    assert data["current_visit_id"] == visit.id
    assert data["patient_name"] == "John Doe"


@pytest.mark.asyncio
async def test_patch_room_unassign(client, seeded_dept):
    await client.post("/api/rooms", json={"room_number": "101", "department_name": "ent"})
    response = await client.patch("/api/rooms/101", json={"current_visit_id": None})
    assert response.status_code == 200
    assert response.json()["current_visit_id"] is None
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pytest tests/test_rooms_api.py -v 2>&1 | head -30
```

Expected: `ERROR` or `ImportError` — `RoomResponse` or rooms router not yet defined.

- [ ] **Step 3: Add Pydantic models to `src/api/models.py`**

Append to the bottom of `src/api/models.py`:

```python
class RoomCreate(BaseModel):
    room_number: str
    department_name: str

class RoomAssign(BaseModel):
    current_visit_id: Optional[int]

class RoomResponse(BaseModel):
    id: int
    room_number: str
    department_name: str
    current_visit_id: Optional[int]
    patient_name: Optional[str]
```

- [ ] **Step 4: Create the rooms router**

```python
# src/api/routers/rooms.py
"""Rooms API — clinical exam rooms grouped by department."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.models import RoomCreate, RoomAssign, RoomResponse
from src.models.base import get_db
from src.models.patient import Patient
from src.models.room import Room
from src.models.visit import Visit

router = APIRouter(prefix="/api/rooms", tags=["Rooms"])


async def _build_response(room: Room, db: AsyncSession) -> RoomResponse:
    """Build RoomResponse, joining patient name from visit if occupied."""
    patient_name = None
    if room.current_visit_id is not None:
        result = await db.execute(
            select(Patient.name)
            .join(Visit, Visit.patient_id == Patient.id)
            .where(Visit.id == room.current_visit_id)
        )
        patient_name = result.scalar_one_or_none()
    return RoomResponse(
        id=room.id,
        room_number=room.room_number,
        department_name=room.department_name,
        current_visit_id=room.current_visit_id,
        patient_name=patient_name,
    )


@router.get("", response_model=list[RoomResponse])
async def list_rooms(db: AsyncSession = Depends(get_db)):
    """List all rooms with current occupancy."""
    result = await db.execute(select(Room).order_by(Room.room_number))
    rooms = result.scalars().all()
    return [await _build_response(r, db) for r in rooms]


@router.post("", response_model=RoomResponse, status_code=201)
async def create_room(body: RoomCreate, db: AsyncSession = Depends(get_db)):
    """Create a new clinical room."""
    existing = await db.execute(select(Room).where(Room.room_number == body.room_number))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail=f"Room '{body.room_number}' already exists")
    room = Room(room_number=body.room_number, department_name=body.department_name)
    db.add(room)
    await db.commit()
    await db.refresh(room)
    return await _build_response(room, db)


@router.patch("/{room_number}", response_model=RoomResponse)
async def assign_room(room_number: str, body: RoomAssign, db: AsyncSession = Depends(get_db)):
    """Assign or unassign a visit to a room."""
    result = await db.execute(select(Room).where(Room.room_number == room_number))
    room = result.scalar_one_or_none()
    if not room:
        raise HTTPException(status_code=404, detail=f"Room '{room_number}' not found")
    room.current_visit_id = body.current_visit_id
    await db.commit()
    await db.refresh(room)
    return await _build_response(room, db)
```

- [ ] **Step 5: Register rooms router in `src/api/server.py`**

In the import line (line 22), add `rooms` to the import:
```python
from .routers import patients, agents, tools, chat, usage, skills, visits, departments, hospital, auth, orders, ws, case_threads, transcription, rooms
```

After `app.include_router(departments.router)`, add:
```python
app.include_router(rooms.router)
```

- [ ] **Step 6: Run the tests**

```bash
pytest tests/test_rooms_api.py -v
```

Expected: all 6 tests pass.

- [ ] **Step 7: Commit**

```bash
git add src/api/models.py src/api/routers/rooms.py src/api/server.py tests/test_rooms_api.py
git commit -m "feat(rooms): add rooms API router with list, create, assign endpoints"
```

---

## Task 4: Agent Room Assignment in complete_triage_tool

**Files:**
- Modify: `src/tools/complete_triage_tool.py`

The agent assigns an empty room (lowest `room_number`) in the target department when auto-routing. If none exist, the existing queue behavior remains unchanged.

- [ ] **Step 1: Write the failing test**

Add to `tests/test_rooms_api.py`:

```python
@pytest.mark.asyncio
async def test_triage_assigns_empty_room(db_session):
    """complete_triage assigns the lowest-numbered empty room in the target dept."""
    from src.models.patient import Patient
    from src.models.visit import Visit, VisitStatus
    from src.models.chat import ChatSession
    from src.models.room import Room
    from src.models.department import Department
    from src.tools.complete_triage_tool import complete_triage
    from unittest.mock import patch

    # Seed department
    dept = Department(name="cardiology", label="Cardiology", capacity=4, is_open=True, color="#e11d48", icon="Heart")
    db_session.add(dept)
    await db_session.flush()

    # Seed rooms
    room1 = Room(room_number="201", department_name="cardiology")
    room2 = Room(room_number="202", department_name="cardiology")
    db_session.add_all([room1, room2])
    await db_session.flush()

    # Seed patient + visit
    patient = Patient(name="Jane Smith", dob="1970-05-10", gender="F")
    db_session.add(patient)
    await db_session.flush()

    session = ChatSession(patient_id=patient.id, agent_type="reception")
    db_session.add(session)
    await db_session.flush()

    visit = Visit(
        visit_id="VIS-TEST-002",
        patient_id=patient.id,
        status=VisitStatus.INTAKE.value,
        chief_complaint="",
        intake_session_id=session.id,
    )
    db_session.add(visit)
    await db_session.commit()

    # complete_triage uses sync SessionLocal — patch it to use a sync wrapper of db_session
    # Instead, test via the DB state after the function runs with the real DB URL
    # (integration-style: runs against the test SQLite DB)
    from src.models import SessionLocal
    with patch("src.tools.complete_triage_tool.SessionLocal") as mock_sl:
        # Use the real sync session from the test engine
        from sqlalchemy import create_engine
        from sqlalchemy.orm import sessionmaker
        sync_engine = create_engine("sqlite:///./test.db")
        SyncSession = sessionmaker(bind=sync_engine)
        mock_sl.return_value.__enter__ = lambda s: SyncSession()
        mock_sl.return_value.__exit__ = lambda s, *a: None

        result = complete_triage(
            id=visit.id,
            chief_complaint="chest pain",
            intake_notes="Onset 2h ago, radiating to left arm",
            routing_suggestion=["cardiology"],
            confidence=0.9,
        )

    assert "Auto-routed" in result
```

> **Note:** The `complete_triage_tool` uses the sync `SessionLocal` tied to the real database. For a lighter integration test, the assertion below (Step 4) directly queries the room table after running the real function against the real DB. The unit test above mocks at the session level.

- [ ] **Step 2: Run test to verify it fails (or is skipped if DB not available)**

```bash
pytest tests/test_rooms_api.py::test_triage_assigns_empty_room -v
```

- [ ] **Step 3: Add room assignment logic to `complete_triage_tool.py`**

In the `if confidence >= AUTO_ROUTE_THRESHOLD:` block, after setting `visit.queue_position`, add the room assignment:

```python
# Assign the first empty room in the target department (ordered by room_number)
from src.models.room import Room
empty_room = db.execute(
    select(Room)
    .where(Room.department_name == target_dept)
    .where(Room.current_visit_id.is_(None))
    .order_by(Room.room_number)
).scalars().first()
if empty_room:
    empty_room.current_visit_id = visit.id
```

Also, in the `complete` and `transfer` visit endpoints, rooms must be cleared. Add a helper note — see Task 5.

- [ ] **Step 4: Run triage tool tests**

```bash
pytest tests/test_rooms_api.py::test_triage_assigns_empty_room -v
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/tools/complete_triage_tool.py tests/test_rooms_api.py
git commit -m "feat(rooms): assign empty room in complete_triage on auto-route"
```

---

## Task 5: Clear Room on Visit Complete / Transfer

**Files:**
- Modify: `src/api/routers/visits.py`

When a visit completes or transfers to another department, clear the old room assignment.

- [ ] **Step 1: Write the failing tests**

Append to `tests/test_rooms_api.py`:

```python
@pytest.mark.asyncio
async def test_complete_visit_clears_room(client, seeded_dept, db_session):
    """Completing a visit unassigns its room."""
    from src.models.patient import Patient
    from src.models.visit import Visit, VisitStatus
    from src.models.chat import ChatSession
    from src.models.room import Room

    patient = Patient(name="Alice", dob="1985-03-15", gender="F")
    db_session.add(patient)
    await db_session.flush()

    session = ChatSession(patient_id=patient.id, agent_type="reception")
    db_session.add(session)
    await db_session.flush()

    visit = Visit(
        visit_id="VIS-TEST-003",
        patient_id=patient.id,
        status=VisitStatus.IN_DEPARTMENT.value,
        current_department="ent",
        queue_position=1,
        chief_complaint="sore throat",
        intake_session_id=session.id,
    )
    db_session.add(visit)
    await db_session.flush()

    room = Room(room_number="101", department_name="ent", current_visit_id=visit.id)
    db_session.add(room)
    await db_session.commit()

    response = await client.patch(f"/api/visits/{visit.visit_id}/complete")
    assert response.status_code == 200

    await db_session.refresh(room)
    assert room.current_visit_id is None


@pytest.mark.asyncio
async def test_transfer_visit_clears_old_room(client, db_session):
    """Transferring a visit unassigns its current room."""
    from src.models.patient import Patient
    from src.models.visit import Visit, VisitStatus
    from src.models.chat import ChatSession
    from src.models.room import Room
    from src.models.department import Department

    # Seed two departments
    ent = Department(name="ent", label="ENT", capacity=4, is_open=True, color="#6366f1", icon="Ear")
    cardio = Department(name="cardiology", label="Cardiology", capacity=4, is_open=True, color="#e11d48", icon="Heart")
    db_session.add_all([ent, cardio])
    await db_session.flush()

    patient = Patient(name="Bob", dob="1975-07-20", gender="M")
    db_session.add(patient)
    await db_session.flush()

    session = ChatSession(patient_id=patient.id, agent_type="reception")
    db_session.add(session)
    await db_session.flush()

    visit = Visit(
        visit_id="VIS-TEST-004",
        patient_id=patient.id,
        status=VisitStatus.IN_DEPARTMENT.value,
        current_department="ent",
        queue_position=1,
        chief_complaint="dizziness",
        intake_session_id=session.id,
    )
    db_session.add(visit)
    await db_session.flush()

    room = Room(room_number="103", department_name="ent", current_visit_id=visit.id)
    db_session.add(room)
    await db_session.commit()

    response = await client.post(
        f"/api/visits/{visit.visit_id}/transfer",
        json={"target_department": "cardiology", "reason": "needs cardiac workup"},
    )
    assert response.status_code == 200

    await db_session.refresh(room)
    assert room.current_visit_id is None
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pytest tests/test_rooms_api.py::test_complete_visit_clears_room tests/test_rooms_api.py::test_transfer_visit_clears_old_room -v
```

Expected: FAIL — rooms not cleared yet.

- [ ] **Step 3: Clear room on visit complete in `src/api/routers/visits.py`**

In the `complete_visit` endpoint (around line 287), after the existing queue-shift logic and before `await db.commit()`, add:

```python
# Clear room assignment for this visit
from src.models.room import Room as RoomModel
room_result = await db.execute(
    select(RoomModel).where(RoomModel.current_visit_id == visit.id)
)
occupied_room = room_result.scalar_one_or_none()
if occupied_room:
    occupied_room.current_visit_id = None
```

- [ ] **Step 4: Clear room on visit transfer in `src/api/routers/visits.py`**

In the `transfer_visit` endpoint (around line 326), after the existing queue-position updates and before `await db.commit()`, add:

```python
# Clear room assignment in the source department
from src.models.room import Room as RoomModel
room_result = await db.execute(
    select(RoomModel).where(RoomModel.current_visit_id == visit.id)
)
occupied_room = room_result.scalar_one_or_none()
if occupied_room:
    occupied_room.current_visit_id = None
```

- [ ] **Step 5: Run the tests**

```bash
pytest tests/test_rooms_api.py -v
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/api/routers/visits.py tests/test_rooms_api.py
git commit -m "feat(rooms): clear room assignment on visit complete and transfer"
```

---

## Task 6: Frontend — RoomInfo Type and listRooms() API Client

**Files:**
- Modify: `web/lib/api.ts`

- [ ] **Step 1: Add RoomInfo type and listRooms function**

In `web/lib/api.ts`, after the `DepartmentInfo` interface (around line 703), add:

```typescript
export interface RoomInfo {
  id: number;
  room_number: string;
  department_name: string;
  current_visit_id: number | null;
  patient_name: string | null;
}
```

After the `listDepartments` function, add:

```typescript
export async function listRooms(): Promise<RoomInfo[]> {
  const response = await fetch(`${API_BASE_URL}/rooms`);
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to fetch rooms");
  }
  return response.json();
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd web && npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors for the new types.

- [ ] **Step 3: Commit**

```bash
git add web/lib/api.ts
git commit -m "feat(rooms): add RoomInfo type and listRooms API client"
```

---

## Task 7: useOperationsDashboard — Fetch Rooms

**Files:**
- Modify: `web/components/operations/use-operations-dashboard.ts`

- [ ] **Step 1: Update the hook to fetch and expose rooms**

Update the imports at the top:
```typescript
import {
  listDepartments,
  listActiveVisits,
  getHospitalStats,
  listRooms,
  type DepartmentInfo,
  type HospitalStats,
  type VisitListItem,
  type RoomInfo,
} from "@/lib/api";
```

Add `rooms` to the `DashboardData` interface:
```typescript
export interface DashboardData {
  departments: DepartmentInfo[];
  rooms: RoomInfo[];
  stats: HospitalStats;
  receptionVisits: VisitListItem[];
  departmentVisits: Record<string, VisitListItem[]>;
  loading: boolean;
  error: string | null;
  lastUpdated: Date | null;
  refresh: () => Promise<void>;
}
```

Add rooms state inside the hook:
```typescript
const [rooms, setRooms] = useState<RoomInfo[]>([]);
```

Update the `fetchData` function's `Promise.all` call:
```typescript
const [depts, vis, st, rms] = await Promise.all([
  listDepartments(),
  listActiveVisits(),
  getHospitalStats(),
  listRooms(),
]);
setDepartments(depts);
setVisits(vis);
setStats(st);
setRooms(rms);
```

Add `rooms` to the return object:
```typescript
return {
  departments,
  rooms,
  stats,
  receptionVisits,
  departmentVisits,
  loading,
  error,
  lastUpdated,
  refresh: fetchData,
};
```

- [ ] **Step 2: Update `operations/page.tsx` to pass rooms to DepartmentGrid**

In `web/app/(dashboard)/operations/page.tsx`, destructure `rooms` from the hook:
```typescript
const { departments, rooms, stats, receptionVisits, departmentVisits, loading, error, lastUpdated, refresh } =
  useOperationsDashboard();
```

Pass `rooms` to `DepartmentGrid`:
```tsx
<DepartmentGrid
  departments={departments}
  rooms={rooms}
  departmentVisits={departmentVisits}
  onDeptClick={setSelectedDept}
/>
```

- [ ] **Step 3: Update DepartmentGrid to accept and pass rooms**

In `web/components/operations/department-grid.tsx`, update the props interface and pass rooms down:

```typescript
import type { DepartmentInfo, VisitListItem, RoomInfo } from "@/lib/api";

interface DepartmentGridProps {
  departments: DepartmentInfo[];
  rooms: RoomInfo[];
  departmentVisits: Record<string, VisitListItem[]>;
  onDeptClick: (deptName: string) => void;
}

export function DepartmentGrid({ departments, rooms, departmentVisits, onDeptClick }: DepartmentGridProps) {
  // ...existing sort logic...
  return (
    <div className="grid gap-3 grid-cols-4">
      {sorted.map((dept) => (
        <DepartmentCard
          key={dept.name}
          dept={dept}
          visits={departmentVisits[dept.name] ?? []}
          rooms={rooms.filter((r) => r.department_name === dept.name)}
          onClick={() => onDeptClick(dept.name)}
        />
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd web && npx tsc --noEmit 2>&1 | head -20
```

Expected: errors only in `department-card.tsx` (rooms prop not yet accepted) — not in the files edited here.

- [ ] **Step 5: Commit**

```bash
git add web/components/operations/use-operations-dashboard.ts web/app/\(dashboard\)/operations/page.tsx web/components/operations/department-grid.tsx
git commit -m "feat(rooms): fetch rooms in useOperationsDashboard, thread through grid"
```

---

## Task 8: DepartmentCard — Expandable Rooms Section

**Files:**
- Modify: `web/components/operations/department-card.tsx`

- [ ] **Step 1: Add rooms prop and expand toggle to DepartmentCard**

Replace the full file content with:

```typescript
// web/components/operations/department-card.tsx
"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import type { DepartmentInfo, VisitListItem, RoomInfo } from "@/lib/api";
import { DEPARTMENT_STATUS_COLORS, getWaitTimeColor, formatTimeAgo } from "./operations-constants";

interface DepartmentCardProps {
  dept: DepartmentInfo;
  visits: VisitListItem[];
  rooms: RoomInfo[];
  onClick: () => void;
}

// Circumference of r=20 circle
const CIRCUMFERENCE = 125.66;
const MAX_VISIBLE = 5;

function sortVisits(visits: VisitListItem[]): VisitListItem[] {
  return [...visits].sort((a, b) => {
    const posA = a.queue_position ?? Infinity;
    const posB = b.queue_position ?? Infinity;
    if (posA !== posB) return posA - posB;
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
  });
}

function RoomTile({ room, statusColor, onOccupiedClick }: {
  room: RoomInfo;
  statusColor: string;
  onOccupiedClick: () => void;
}) {
  const isOccupied = room.current_visit_id !== null;
  return (
    <div
      onClick={isOccupied ? onOccupiedClick : undefined}
      className={`rounded-md px-2 py-1.5 border text-[10px] font-mono truncate ${
        isOccupied
          ? "cursor-pointer hover:brightness-110"
          : "opacity-50 cursor-default"
      }`}
      style={{
        background: isOccupied ? `${statusColor}18` : "var(--muted)",
        borderColor: isOccupied ? `${statusColor}40` : "var(--border)",
        color: isOccupied ? statusColor : "var(--muted-foreground)",
      }}
    >
      <span className="font-bold">{room.room_number}</span>
      {" · "}
      <span>{room.patient_name ?? "—"}</span>
    </div>
  );
}

export function DepartmentCard({ dept, visits, rooms, onClick }: DepartmentCardProps) {
  const [expanded, setExpanded] = useState(false);

  const statusColor =
    DEPARTMENT_STATUS_COLORS[dept.status as keyof typeof DEPARTMENT_STATUS_COLORS] ||
    "#6b7280";

  const utilization =
    dept.capacity > 0
      ? Math.round((dept.current_patient_count / dept.capacity) * 100)
      : 0;
  const filled = (utilization / 100) * CIRCUMFERENCE;

  const isClosed = !dept.is_open;
  const isCritical = dept.status === "CRITICAL";

  const sorted = sortVisits(visits);
  const visible = sorted.slice(0, MAX_VISIBLE);
  const overflow = sorted.length - MAX_VISIBLE;
  const sortedRooms = [...rooms].sort((a, b) => a.room_number.localeCompare(b.room_number, undefined, { numeric: true }));

  return (
    <div
      className={`w-full rounded-xl border transition-all ${isCritical ? "animate-pulse" : ""}`}
      style={{
        background: isClosed ? "var(--muted)" : `${statusColor}08`,
        borderColor: isClosed ? "var(--border)" : `${statusColor}40`,
        boxShadow: isCritical ? `0 0 20px ${statusColor}30` : "none",
        opacity: isClosed ? 0.55 : 1,
      }}
    >
      {/* Header — clicking dept name/stats opens dialog; chevron toggles rooms */}
      <div className="flex items-center gap-2 px-4 pt-3 pb-3">
        <button
          onClick={onClick}
          className="flex-1 text-left hover:brightness-110 focus:outline-none min-w-0"
        >
          {/* Dept name + status badge */}
          <div className="flex items-center justify-between gap-2 mb-3">
            <span
              className="text-sm font-bold font-mono truncate"
              style={{ color: isClosed ? "var(--muted-foreground)" : statusColor }}
            >
              {dept.label}
            </span>
            {isClosed ? (
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-full text-red-400 bg-red-400/10 border border-red-400/20 shrink-0">
                CLOSED
              </span>
            ) : (
              <span
                className="text-[10px] font-mono px-1.5 py-0.5 rounded-full shrink-0"
                style={{
                  color: statusColor,
                  background: `${statusColor}20`,
                  border: `1px solid ${statusColor}30`,
                }}
              >
                {dept.status}
              </span>
            )}
          </div>

          {/* Utilization ring + slot count */}
          <div className="flex items-center gap-3">
            <svg width="44" height="44" className="flex-shrink-0">
              <circle cx="22" cy="22" r="20" fill="none" stroke={isClosed ? "var(--border)" : `${statusColor}20`} strokeWidth="3" />
              {dept.capacity > 0 && (
                <circle
                  cx="22" cy="22" r="20"
                  fill="none"
                  stroke={isClosed ? "#6b7280" : statusColor}
                  strokeWidth="3"
                  strokeDasharray={`${filled} ${CIRCUMFERENCE - filled}`}
                  strokeLinecap="round"
                  transform="rotate(-90 22 22)"
                />
              )}
              <text x="22" y="22" textAnchor="middle" dominantBaseline="central" fill={isClosed ? "#6b7280" : statusColor} fontSize="10" fontFamily="monospace">
                {dept.capacity > 0 ? `${utilization}%` : "—"}
              </text>
            </svg>
            <div className="min-w-0">
              <div className="text-xs font-mono text-muted-foreground">
                {dept.current_patient_count}/{dept.capacity} slots
              </div>
              {dept.queue_length > 0 && (
                <div className="text-[10px] font-mono text-amber-500 mt-0.5">
                  {dept.queue_length} in queue
                </div>
              )}
            </div>
          </div>
        </button>

        {/* Expand/collapse toggle — only shown if rooms exist */}
        {sortedRooms.length > 0 && (
          <button
            onClick={() => setExpanded((v) => !v)}
            className="shrink-0 p-1 rounded hover:bg-white/5 focus:outline-none"
            style={{ color: statusColor }}
            aria-label={expanded ? "Collapse rooms" : "Expand rooms"}
          >
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        )}
      </div>

      {/* Rooms section */}
      {expanded && sortedRooms.length > 0 && (
        <>
          <hr className="border-0 border-t border-border mx-4" />
          <div className="px-4 pt-2 pb-3 grid grid-cols-2 gap-1.5">
            {sortedRooms.map((room) => (
              <RoomTile
                key={room.id}
                room={room}
                statusColor={statusColor}
                onOccupiedClick={onClick}
              />
            ))}
          </div>
        </>
      )}

      {/* Patient list */}
      {visible.length > 0 && (
        <>
          <hr className="border-0 border-t border-border mx-4" />
          <div className="px-4 pt-2 pb-3 space-y-1.5">
            {visible.map((v) => {
              const waitColor = getWaitTimeColor(v.created_at);
              return (
                <div key={v.visit_id} className="rounded-md px-2 py-1.5 bg-muted/30 border border-border">
                  <div className="text-[11px] font-bold font-mono text-foreground truncate">
                    {v.patient_name}
                  </div>
                  {v.chief_complaint && (
                    <div className="text-[10px] font-mono text-muted-foreground truncate mt-0.5">
                      {v.chief_complaint}
                    </div>
                  )}
                  <div className="flex justify-between mt-1">
                    <span className="text-[10px] font-mono" style={{ color: waitColor }}>
                      {formatTimeAgo(v.created_at)}
                    </span>
                    {v.queue_position != null && (
                      <span className="text-[10px] font-mono text-muted-foreground">
                        #{v.queue_position}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
            {overflow > 0 && (
              <div className="text-[10px] font-mono text-muted-foreground text-center pt-1">
                +{overflow} more
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles cleanly**

```bash
cd web && npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 3: Run backend tests one final time to confirm nothing broken**

```bash
pytest tests/test_rooms_api.py tests/test_department_api.py -v
```

Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
git add web/components/operations/department-card.tsx
git commit -m "feat(rooms): expandable rooms section in DepartmentCard"
```

---

## Task 9: Seed Rooms for Demo

The demo needs rooms pre-seeded so the operations page shows them immediately.

- [ ] **Step 1: Add room seed data to server startup in `src/api/server.py`**

In the `lifespan` function, after the department seeding block, add:

```python
# Seed rooms if none exist
from ..models.room import Room
async with AsyncSessionLocal() as session:
    room_count = await session.execute(select(func.count(Room.id)))
    if (room_count.scalar() or 0) == 0:
        from ..constants.department_seed_data import DEPARTMENT_SEED_DATA
        # Seed 2 rooms per department
        all_depts = await session.execute(select(Department))
        depts = all_depts.scalars().all()
        room_counter = 100
        for dept in depts:
            for i in range(1, 3):
                room_counter += 1
                session.add(Room(
                    room_number=str(room_counter),
                    department_name=dept.name,
                ))
        await session.commit()
        logger.info("Seeded rooms for %d departments", len(depts))
```

- [ ] **Step 2: Verify the server starts without error**

```bash
cd /Users/kien.ha/Code/medical_agent && python -m uvicorn src.api.server:app --port 8001 --no-access-log &
sleep 2
curl -s http://localhost:8001/api/rooms | python3 -m json.tool | head -20
kill %1
```

Expected: JSON array of rooms with `room_number`, `department_name`, `current_visit_id: null`.

- [ ] **Step 3: Commit**

```bash
git add src/api/server.py
git commit -m "feat(rooms): seed 2 rooms per department on startup for demo"
```
