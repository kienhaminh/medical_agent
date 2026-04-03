# Patient Tracking Page — Design Spec

**Date:** 2026-04-03
**Status:** Approved

## Overview

After the intake agent shows the "Check-in Complete" card, it generates a public tracking link (`/track/[visitId]`) the patient can open on any device. The page shows their full journey for the visit: an ordered itinerary of stops the agent generated, current queue position, assigned doctor, doctor's notes, lab/imaging orders, chief complaint, and urgency level. Steps auto-advance when the system detects a department transfer; staff can manually override.

---

## Entry Point

The intake chat `IntakeChat` component renders a "Check-in Complete" card when `complete_triage` succeeds. After calling `set_itinerary`, the agent's closing message includes a tracking link:

```
Your tracking page: /track/VIS-20260403-012
```

The frontend renders this as a clickable button/link in the "Check-in Complete" card. No authentication required — the visit ID is the access token.

---

## Data Model

### New: `visit_steps` table

```sql
visit_steps
───────────────────────────────
id              INTEGER PK
visit_id        INTEGER FK → visits.id
step_order      INTEGER          -- 1-based, defines display and advance order
department      VARCHAR(50) FK → departments.name  -- nullable (e.g. for "Intake")
label           VARCHAR(200)     -- "ENT Department", "Blood Test Lab"
description     VARCHAR(500)     -- "Ear, nose & throat examination · Room 204"
room            VARCHAR(100)     -- nullable
status          ENUM(pending, active, done)  default: pending
completed_at    DATETIME         -- nullable, set when done
created_at      DATETIME
```

The tool **auto-prepends a "Registration & Intake" step** (status: `done`, completed_at = now) before the agent-provided steps. The first agent-provided step is then set to `active`. Subsequent steps remain `pending` until auto-advanced or manually completed.

The `department` FK is **nullable** — steps not tied to a department row (e.g. a blood draw in a hallway lab, a bedside test) set `department = null` and rely on `label` and `room` for display.

---

## New Agent Tool: `set_itinerary`

Called by the reception agent immediately after `complete_triage`, once the agent has checked available rooms and determined the patient's multi-stop route.

```python
def set_itinerary(
    visit_id: int,
    steps: list[dict],
) -> str:
    """Define the ordered list of stops for a patient's visit.

    Call this after complete_triage to give the patient a clear roadmap.
    Each step becomes a row in visit_steps. The first step is auto-activated.

    Args:
        visit_id: The visit DB id (from system context)
        steps: Ordered list of stops. Each dict:
            - order (int): Position in sequence, starting at 1
            - department (str): Department name key (e.g. "ent", "gastroenterology")
            - label (str): Human-readable name ("ENT Department")
            - description (str): What happens here ("Ear, nose & throat exam")
            - room (str, optional): Room or location ("Room 204, Floor 2")

    Returns:
        Confirmation with tracking link to share with patient.
    """
```

**Example agent call:**
```python
set_itinerary(
    visit_id=12,
    steps=[
        {"order": 1, "department": "ent", "label": "ENT Department",
         "description": "Ear, nose & throat examination", "room": "Room 204"},
        {"order": 2, "department": None, "label": "Blood Test Lab",
         "description": "CBC & metabolic panel", "room": "Lab A, Floor 1"},
        {"order": 3, "department": "gastroenterology", "label": "Gastroenterology",
         "description": "Final consultation with specialist", "room": "Wing B"},
    ]
)
```

**Returns:**
```
Itinerary set: 3 steps created. Step 1 (ENT Department) is now active.
Tracking link for patient: /track/VIS-20260403-012
```

---

## Step Status Lifecycle

```
pending → active → done
```

### Auto-advance (primary)

Triggered **server-side inside the `/transfer` and `/check-in` endpoint handlers**, before returning the response — not from WebSocket events (those are notifications, not triggers):

1. After updating `visit.current_department`, query `VisitStep` for this visit
2. Find the currently `active` step → mark it `done` (set `completed_at = now`)
3. Find the next `pending` step where `department == new_current_department` (or the next by `step_order` if no department match)
4. Mark that step `active`
5. Emit `STEP_UPDATED` WebSocket event so connected tracking pages update in real-time

### Manual override (staff)

```
PATCH /api/visits/{visit_id}/steps/{step_id}/complete
```

Marks a step as `done` regardless of current department. Used when a step is skipped, completed early, or done outside the normal transfer flow. Also auto-activates the next `pending` step.

---

## New API Endpoint

### `GET /api/visits/{visit_id}/track`

Public endpoint — no auth required. Returns everything the tracking page needs in a single call.

**Response:**
```json
{
  "visit_id": "VIS-20260403-012",
  "patient_name": "Jordan Park",
  "status": "in_department",
  "urgency_level": "routine",
  "chief_complaint": "Persistent stomach pain after meals for 3 weeks",
  "assigned_doctor": "Dr. Sarah Nguyen",
  "current_department": "ent",
  "queue_position": 1,
  "clinical_notes": "Mild nasal congestion noted...",
  "steps": [
    {"id": 1, "step_order": 1, "label": "Registration & Intake",
     "description": "Completed at reception", "room": null,
     "status": "done", "completed_at": "2026-04-03T14:15:00"},
    {"id": 2, "step_order": 2, "label": "ENT Department",
     "description": "Ear, nose & throat examination", "room": "Room 204",
     "status": "active", "completed_at": null},
    {"id": 3, "step_order": 3, "label": "Blood Test Lab",
     "description": "CBC & metabolic panel", "room": "Lab A, Floor 1",
     "status": "pending", "completed_at": null},
    {"id": 4, "step_order": 4, "label": "Gastroenterology",
     "description": "Final consultation", "room": "Wing B",
     "status": "pending", "completed_at": null}
  ],
  "orders": [
    {"order_name": "CBC Panel", "order_type": "lab", "status": "pending"},
    {"order_name": "Metabolic Panel", "order_type": "lab", "status": "pending"}
  ]
}
```

---

## Frontend: `/track/[visitId]`

**Route:** `web/app/track/[visitId]/page.tsx` — public, no layout wrapper, no auth check.

**Component:** `web/components/tracking/visit-tracker.tsx`

### Page sections (top to bottom)

1. **Header bar** — hospital name + visit ID
2. **Patient info** — name, status badge, urgency level badge, time since arrival
3. **Chief complaint card** — what the patient described at intake (read-only)
4. **Assigned doctor card** — doctor name + department
5. **Itinerary** — vertical step list:
   - Done steps: greyed out, crossed-out label, completion time
   - Active step: blue highlight, expanded to show queue position + doctor's note (if any) + linked lab/imaging orders with status badges
   - Pending steps: dimmed, show label + room + any pre-ordered labs as pill badges
6. **Real-time indicator** — subtle "Live" badge in the header when WebSocket is connected

### Real-time updates

The page connects to the existing WebSocket endpoint on mount. It listens for:
- `STEP_UPDATED` → re-fetch or patch step status in local state
- `QUEUE_UPDATED` → update queue position on active step
- `VISIT_NOTES_UPDATED` → update doctor's note on active step
- `LAB_CRITICAL` → show urgent alert banner

On reconnect, re-fetch `/api/visits/{id}/track` to sync any missed events.

### Intake chat: tracking link in check-in card

The existing "Check-in Complete" card in `IntakeChat` detects when the agent's message contains `/track/VIS-...` and renders a styled button below the card:

```
[ 🔗 Track your visit progress ]
```

---

## Intake Prompt Update

The intake system prompt (`src/prompt/intake.py`) gets a new step after `complete_triage`:

```
### Step 5 — Set Patient Itinerary
After complete_triage succeeds, check available rooms and call set_itinerary(...)
with the patient's full multi-stop route. Include every department the patient
needs to visit in order. The tracking link in the return value should be included
in your closing message to the patient.
```

---

## Files to Create / Modify

| File | Action |
|------|--------|
| `src/models/visit_step.py` | **Create** — VisitStep model |
| `src/models/__init__.py` | **Modify** — export VisitStep |
| `alembic/versions/xxx_add_visit_steps.py` | **Create** — migration |
| `src/tools/set_itinerary_tool.py` | **Create** — set_itinerary tool |
| `src/tools/__init__.py` | **Modify** — import new tool |
| `src/api/routers/visits.py` | **Modify** — add GET /track + PATCH /steps/{id}/complete |
| `src/api/ws/events.py` | **Modify** — add STEP_UPDATED event |
| `src/prompt/intake.py` | **Modify** — add Step 5 for set_itinerary |
| `web/app/track/[visitId]/page.tsx` | **Create** — public tracking page |
| `web/components/tracking/visit-tracker.tsx` | **Create** — main tracking component |
| `web/components/tracking/step-item.tsx` | **Create** — single step row component |
| `web/components/reception/intake-chat.tsx` | **Modify** — render tracking link in check-in card |

---

## Out of Scope

- Patient authentication / login to view tracking page
- Push notifications (SMS/email) when steps advance
- Patient ability to message the care team from the tracking page
- Estimated wait times per step (can be added later once queue metrics exist)
