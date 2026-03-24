# Phase 1: Visit Files & Reception Flow — Design Spec

## Overview

Build the foundation for the hospital department agent workflow: a Visit model that tracks patient encounters, a Reception AI agent that conducts intake conversations and triages patients, and a Doctor's review queue where low-confidence cases are manually routed.

### Scope

- **In scope:** Visit model, Reception agent, intake conversation, auto-routing for clear cases, doctor review queue for unclear cases, two new frontend pages
- **Out of scope:** Department agent processing, Kanban task queues, patient-facing pipeline view (Phases 2–4)

### Success criteria

1. Staff can start a new visit for a patient from the Reception page
2. The Reception agent conducts an intake conversation and produces a triage
3. High-confidence visits are auto-routed to suggested departments
4. Low-confidence visits land in the doctor's review queue
5. A doctor can approve, redirect, or view the intake for any visit

---

## Data Model

### Visit

New SQLAlchemy model in `src/models/`.

| Column | Type | Description |
|--------|------|-------------|
| `id` | `Integer`, PK | Auto-increment |
| `visit_id` | `String(20)`, unique, indexed | Format: `VIS-YYYYMMDD-NNN` (e.g., `VIS-20260324-001`). Auto-generated on creation. NNN resets daily. |
| `patient_id` | `Integer`, FK → `patients.id` | Required |
| `status` | `Enum` | One of: `intake`, `triaged`, `auto_routed`, `pending_review`, `routed`, `in_department`, `completed` |
| `confidence` | `Float`, nullable | 0.0–1.0. Set by Reception agent after triage. |
| `routing_suggestion` | `JSON`, nullable | List of department name strings the agent recommends (e.g., `["cardiology", "radiology"]`) |
| `routing_decision` | `JSON`, nullable | Final list of departments. Set by doctor approval or auto-route copy from suggestion. |
| `chief_complaint` | `String(500)`, nullable | One-line symptom summary from intake |
| `intake_notes` | `Text`, nullable | Structured intake summary produced by the agent |
| `intake_session_id` | `Integer`, FK → `chat_sessions.id`, nullable | Links to the ChatSession for the intake conversation |
| `reviewed_by` | `String(200)`, nullable | Doctor name/ID who reviewed. Null for auto-routed cases. |
| `created_at` | `DateTime`, server default `now()` | |
| `updated_at` | `DateTime`, server default `now()`, onupdate `now()` | |

**Status enum values:** `intake`, `triaged`, `auto_routed`, `pending_review`, `routed`, `in_department`, `completed`

**Visit ID generation:** On `POST /api/visits`, query for the max NNN for today's date and increment. Handle concurrency via a retry loop (max 3 attempts) catching `IntegrityError` on the unique constraint.

**Indexes:** `status` (for queue filtering), `patient_id` (for patient visit history), `created_at` (for ordering).

---

## Visit Lifecycle & State Machine

```
intake → triaged → auto_routed ──→ routed → in_department → completed
                 ↘ pending_review → routed ↗
```

| State | Owner | Trigger |
|-------|-------|---------|
| `intake` | Reception Agent | Visit created via `POST /api/visits` |
| `triaged` | System | Reception agent calls `complete_triage` tool |
| `auto_routed` | System | `confidence >= 0.7` — routing_decision copied from routing_suggestion |
| `pending_review` | General Doctor | `confidence < 0.7` — visit enters doctor's queue |
| `routed` | Doctor / System | Doctor approves via `PATCH /api/visits/{id}/route`. Auto-routed visits stay at `auto_routed` in Phase 1 — doctor can still override. Phase 2 transitions them to `routed` when a department agent picks up. |
| `in_department` | Department | Phase 2 — department agent picks up the task |
| `completed` | System | Phase 2 — all department work done |

**Confidence threshold:** 0.7 (configurable). Above = auto-route. Below = pending_review.

**Phase 1 active states:** `intake`, `triaged`, `auto_routed`, `pending_review`, `routed`. The `in_department` and `completed` states exist in the enum but are not transitioned to in Phase 1.

---

## API Routes

New router: `src/api/routers/visits.py`

### POST /api/visits

Create a new visit and start intake.

**Request body:**
```json
{
  "patient_id": 1
}
```

**Behavior:**
1. Validate no other visit for this `patient_id` is currently in `intake` status (reject with 409 if so)
2. Look up the Reception agent by `role = "reception_triage"` in the `sub_agents` table
3. Generate `visit_id` (VIS-YYYYMMDD-NNN)
4. Create a `ChatSession` with `title = "Intake - {visit_id}"` and `agent_id` set to the Reception agent's ID
5. Create a `Visit` with `status=intake`, `intake_session_id` pointing to the new session
6. Return the Visit with session info

**Response:** `VisitResponse` (see Pydantic models below)

### GET /api/visits

List visits with optional filters.

**Query params:**
- `status` — filter by status (e.g., `?status=pending_review`)
- `patient_id` — filter by patient
- `limit` — default 50
- `offset` — default 0

**Response:** `List[VisitResponse]`

### GET /api/visits/{id}

Get visit detail.

**Response:** `VisitDetailResponse` (includes patient info, intake notes, routing data)

### PATCH /api/visits/{id}/route

Doctor approves or changes routing.

**Request body:**
```json
{
  "routing_decision": ["cardiology"],
  "reviewed_by": "Dr. Smith"
}
```

**Behavior:**
1. Validate visit is in `auto_routed` or `pending_review` status
2. Set `routing_decision`, `reviewed_by`
3. Move status to `routed`

**Response:** `VisitResponse`

### Pydantic Models

```python
class VisitCreate(BaseModel):
    patient_id: int

class VisitRouteUpdate(BaseModel):
    routing_decision: list[str]
    reviewed_by: str

class VisitResponse(BaseModel):
    id: int
    visit_id: str
    patient_id: int
    status: str
    confidence: float | None
    routing_suggestion: list[str] | None
    routing_decision: list[str] | None
    chief_complaint: str | None
    intake_session_id: int | None
    reviewed_by: str | None
    created_at: str
    updated_at: str

class VisitDetailResponse(VisitResponse):
    patient_name: str  # Flattened from Patient join (Patient.name)
    patient_dob: str   # Flattened from Patient join (Patient.dob)
    patient_gender: str  # Flattened from Patient join (Patient.gender)
    intake_notes: str | None
```

---

## Reception Agent

### SubAgent Configuration

A row in the `sub_agents` table:

| Field | Value |
|-------|-------|
| `name` | `Reception` |
| `role` | `reception_triage` |
| `description` | `Conducts patient intake conversations and triages to appropriate departments` |
| `system_prompt` | See below |
| `enabled` | `true` |
| `color` | `#00CCC0` |
| `icon` | `clipboard-list` |

### System Prompt (Summary)

The full system prompt instructs the agent to:

1. Greet the patient warmly and ask the reason for their visit
2. Ask focused follow-up questions (5–7 max) about: onset, duration, severity, location, triggers, associated symptoms, medical history relevance
3. Reference the patient's existing records when available
4. When sufficient information is gathered, call the `complete_triage` tool with:
   - `chief_complaint`: one-line summary
   - `intake_notes`: structured symptom assessment
   - `routing_suggestion`: list of department names
   - `confidence`: score from 0.0 to 1.0

**Confidence guidelines embedded in the prompt:**
- 0.8–1.0: Clear single-department case (e.g., "broken arm" → Orthopedics)
- 0.5–0.79: Probable match but some ambiguity (e.g., "chest pain" → Cardiology or GI)
- Below 0.5: Unclear, multiple possible causes, needs general doctor review

### complete_triage Tool

Implemented as a **built-in tool handler** in `src/agent/tools/complete_triage.py` (not stored as user-editable code in the `CustomTool` table). Registered to the Reception agent via the `CustomTool` table with `tool_type="builtin"` and `symbol="complete_triage"`, but the actual handler logic lives in Python code that has direct DB access.

**Tool schema:**
```json
{
  "name": "complete_triage",
  "description": "Complete the patient intake triage. Call this when you have gathered enough information to suggest a department routing.",
  "parameters": {
    "type": "object",
    "properties": {
      "id": { "type": "integer", "description": "The visit primary key ID (provided in system context)" },
      "chief_complaint": { "type": "string", "description": "One-line summary of the patient's primary concern" },
      "intake_notes": { "type": "string", "description": "Structured summary of symptoms, history, and assessment" },
      "routing_suggestion": {
        "type": "array",
        "items": { "type": "string" },
        "description": "List of department names to route to (e.g., ['cardiology', 'radiology'])"
      },
      "confidence": {
        "type": "number",
        "minimum": 0.0,
        "maximum": 1.0,
        "description": "Confidence in the routing suggestion (0.0-1.0)"
      }
    },
    "required": ["id", "chief_complaint", "intake_notes", "routing_suggestion", "confidence"]
  }
}
```

**Tool handler behavior:**
1. Look up the Visit by `id` (integer PK)
2. Update: `chief_complaint`, `intake_notes`, `routing_suggestion`, `confidence`
3. Set `status = triaged`
4. If `confidence >= 0.7`: set `routing_decision = routing_suggestion`, `status = auto_routed`
5. If `confidence < 0.7`: set `status = pending_review`
6. Return confirmation message to the agent (agent can then give a closing message to the patient)

---

## Frontend

### New Page: Reception Intake — `/reception`

**Route:** `web/app/(dashboard)/reception/page.tsx`

**Layout:** Two-column
- **Left column (narrow):** Patient selector (search/dropdown from existing patient list API), visit info card (visit ID, status, patient demographics), previous records summary
- **Right column (wide):** Chat interface with the Reception agent. Reuses existing chat message components from `AiAssistantPanel`.

**Flow:**
1. Staff lands on `/reception` → sees patient search
2. Selects a patient → clicks "Start Visit"
3. `POST /api/visits` creates the visit → chat session starts
4. Patient (or staff proxy) chats with the Reception agent
5. When agent calls `complete_triage`, the visit info card updates to show triage status
6. Staff can navigate to `/doctor/queue` to see the result

**Key components to create:**
- `web/app/(dashboard)/reception/page.tsx` — page shell
- `web/components/reception/patient-selector.tsx` — patient search + "Start Visit" button
- `web/components/reception/visit-info-card.tsx` — visit status sidebar
- `web/components/reception/intake-chat.tsx` — chat panel (wraps existing chat components)

### New Page: Doctor's Review Queue — `/doctor/queue`

**Route:** `web/app/(dashboard)/doctor/queue/page.tsx`

**Layout:** Tabbed list view
- **Tab "Needs Review":** Visits with `status=pending_review`, ordered by `created_at` descending
- **Tab "Auto-Routed":** Visits with `status=auto_routed`, ordered by `created_at` descending
- **Tab "All Visits":** All non-intake visits, ordered by `created_at` descending

**Each visit card shows:**
- Patient name, visit ID, created time
- Chief complaint
- Suggested department(s) with confidence score
- Color coding: orange for needs review, green for auto-routed
- Action buttons:
  - "Approve Route" — calls `PATCH /api/visits/{id}/route` with the current suggestion
  - "Change Department" — opens a department selector dialog, then calls the PATCH
  - "View Intake" — opens a dialog/drawer showing the intake conversation (read-only)

**Key components to create:**
- `web/app/(dashboard)/doctor/queue/page.tsx` — page shell with tabs
- `web/components/doctor/visit-queue-card.tsx` — individual visit card
- `web/components/doctor/route-approval-dialog.tsx` — change department dialog
- `web/components/doctor/intake-viewer-dialog.tsx` — read-only intake conversation viewer

### Sidebar Update

Add two new links to the existing sidebar (`web/components/sidebar.tsx`):

| Label | Route | Icon | Position |
|-------|-------|------|----------|
| Reception | `/reception` | `ClipboardList` | After "Patients" |
| Doctor Queue | `/doctor/queue` | `Stethoscope` | After "Reception" |

### Chat Integration for Intake

The intake conversation uses the existing `/api/chat` endpoint. Key integration details:

1. **Starting the chat:** `POST /api/visits` creates the Visit + ChatSession internally. The frontend receives `intake_session_id` in the response and uses it for all subsequent `sendChatMessage` calls.
2. **Sending messages:** Frontend calls `POST /api/chat/send` with `{ message, session_id: visit.intake_session_id, patient_id: visit.patient_id }`. The `patient_id` enables the Reception agent to access patient records via existing tools.
3. **Agent context injection:** The Reception agent's system prompt is dynamically augmented with: `"You are conducting intake for Visit {visit.visit_id} (PK: {visit.id}). Patient: {patient.name}, DOB: {patient.dob}."` This ensures the agent knows the visit PK to pass to `complete_triage`.
4. **Triage completion detection:** When the `complete_triage` tool is called, the tool handler updates the Visit in the DB. The frontend polls `GET /api/visits/{id}` every 3 seconds during the chat to detect status changes. When status changes from `intake`, the visit info card updates.

### Existing Components Reused

- Chat message rendering from `AiAssistantPanel` (message bubbles, tool call display, streaming)
- Patient list/search from existing patient API (`listPatients`)
- `ChatSession` + `/api/chat/send` for the intake conversation flow

### Edge Cases

- **Duplicate active visits:** `POST /api/visits` returns 409 if the patient already has a visit in `intake` status.
- **Doctor queue refresh:** The doctor queue page polls `GET /api/visits?status=pending_review` every 5 seconds. No WebSocket needed for Phase 1.
- **Failed triage:** If the Reception agent fails or the chat is abandoned, the visit stays in `intake` status indefinitely. No auto-cleanup in Phase 1 (staff can manually navigate away).

---

## Department List (String Constants)

For Phase 1, departments are string constants (not a DB model). Used in the `routing_suggestion` and `routing_decision` JSON fields, and in the doctor's "Change Department" selector.

```python
DEPARTMENTS = [
    "general_checkup",
    "cardiology",
    "neurology",
    "orthopedics",
    "dermatology",
    "gastroenterology",
    "pulmonology",
    "endocrinology",
    "ophthalmology",
    "ent",
    "urology",
    "radiology",
    "internal_medicine",
    "emergency",
]
```

Phase 2 promotes these to a `Department` model with agent assignment.

---

## What This Does NOT Include

- Department agent processing (Phase 2)
- Kanban board UI (Phase 2)
- Agent-to-department assignment (Phase 3)
- Patient-facing pipeline view (Phase 4)
- Real-time WebSocket updates (uses polling for now)
- Authentication / role-based access (doctor vs staff)
