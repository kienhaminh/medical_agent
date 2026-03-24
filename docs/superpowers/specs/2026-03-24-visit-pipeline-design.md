# Unified Visit Pipeline — Design Spec

**Date:** 2026-03-24
**Status:** Approved
**Replaces:** `/reception` page, `/doctor/queue` page

## Summary

Replace the separate Reception and Doctor Queue pages with a single unified Kanban pipeline view at `/pipeline`. Patients initiate visits by chatting on the public page (`/`), where the reception agent autonomously collects information, identifies or creates patient records, and creates visit records. Staff monitor and act on visits through the pipeline board.

## Goals

- Single view for all active visits across all stages
- Autonomous agent-driven intake (no staff intervention to start visits)
- Stage-appropriate actions in the detail panel
- Real-time updates via polling

## Non-Goals

- Patient authentication or login on public page
- Drag-and-drop between kanban columns
- Department-specific specialist views (future)
- Visit analytics or reporting

---

## Architecture

### Two Surfaces, One Data Flow

1. **Public page `/`** (patient-facing) — existing chat, enhanced with agent tools for patient/visit creation
2. **Staff pipeline `/pipeline`** (new, auth-required) — Kanban + Detail Panel

### Data Flow

```
Patient starts chat on /
  → Agent greets, collects name, DOB, gender, symptoms
  → Agent calls find_patient tool (search by name + DOB)
  → If no match: agent calls create_patient tool
  → Agent reasons about symptoms, determines routing
  → Agent calls create_visit tool (status: intake → auto_routed or pending_review)
  → Visit appears on staff pipeline kanban
  → Staff monitors, reviews, approves routing
```

---

## Staff Pipeline Page (`/pipeline`)

### Layout: Kanban + Detail Panel

- **Left (flex: 2):** Kanban columns showing visit cards
- **Right (flex: 1.5):** Detail panel for selected visit
- **Header:** Page title, active visit count, "Show Completed" toggle

### Kanban Columns

| Column | Status | Color | Description |
|--------|--------|-------|-------------|
| Intake | `intake` | Cyan (#00d9ff) | Agent chatting with patient |
| Routing | `auto_routed` | Purple (#a78bfa) | Agent finished, confidence ≥ 0.7 |
| Needs Review | `pending_review` | Amber (#f59e0b) | Confidence < 0.7, doctor must act |
| Routed | `routed` | Green (#10b981) | Doctor approved routing |
| In Department | `in_department` | Indigo (#6366f1) | Patient receiving specialist care |

**Completed visits** are hidden by default. A "Show Completed" toggle in the header reveals a collapsed Completed column (today's visits only).

### Visit Cards

Each card displays:
- Patient name
- Visit ID (e.g., VIS-20260324-001)
- Chief complaint snippet (truncated to ~50 chars)
- Time elapsed since visit creation (e.g., "12m ago")
- Status indicator dot (column color)
- Card count badge on column header

Cards are sorted by `created_at` descending (newest first).

### Detail Panel

Adapts content based on the selected visit's current stage:

**Intake stage:**
- Patient info collected so far (name, DOB, gender)
- Live chat transcript (read-only for staff, auto-scrolls)
- Progress indicator showing intake status
- Chief complaint (if extracted)

**Auto-Routed / Pending Review stage:**
- Patient info summary
- Chief complaint
- Full intake notes
- Routing suggestion (department list) + confidence score (percentage)
- "Approve Route" button (accepts suggestion as-is)
- "Change Route" button (opens department multi-select)
- "Reviewed by" name input
- Link to view full intake chat transcript

**Routed stage:**
- Patient info summary
- Routing decision (departments)
- Reviewed by (doctor name)
- Chief complaint + intake notes

**In Department stage:**
- Patient info summary
- Department assignment
- Routing history
- Placeholder for specialist notes (future)

**Empty state (no visit selected):**
- "Select a visit to view details" message

### Polling & Real-time Updates

- Polls `GET /api/visits` every 5 seconds
- Preserves selected visit when data refreshes
- New visits animate into the Intake column
- Cards moving between columns animate the transition

---

## Backend Changes

### Agent Tools (New)

The reception triage agent gains three new tools:

**`find_patient`**
- Input: `name` (string), `dob` (string, optional)
- Output: List of matching patients or empty array
- Searches by name (fuzzy match), filters by DOB if provided

**`create_patient`**
- Input: `name` (string), `dob` (string), `gender` (string)
- Output: Created patient record with ID
- Agent calls this when find_patient returns no matches

**`create_visit`**
- Input: `patient_id` (int), `chief_complaint` (string), `intake_notes` (string), `routing_suggestion` (string[]), `confidence` (float)
- Output: Created visit record with visit_id
- Automatically sets status to `auto_routed` (confidence ≥ 0.7) or `pending_review` (confidence < 0.7)
- Links the current chat session as `intake_session_id`

### Agent System Prompt Update

The reception triage agent's system prompt is updated to guide the autonomous intake flow:

1. Greet the patient warmly
2. Collect: full name, date of birth, gender
3. Search for existing patient record (find_patient)
4. If not found, create new patient record (create_patient)
5. Ask about symptoms, chief complaint, duration, severity
6. Reason about appropriate department routing
7. Create visit record with routing suggestion and confidence score (create_visit)
8. Inform the patient that their information has been recorded and they will be seen

### API Changes

No new API endpoints needed. Existing endpoints support all operations:
- `POST /api/patients` — create patient (used by agent tool)
- `GET /api/patients` — search patients (used by agent tool)
- `POST /api/visits` — create visit (used by agent tool)
- `GET /api/visits` — list visits with status filter (used by pipeline polling)
- `GET /api/visits/{id}` — get visit detail (used by detail panel)
- `PATCH /api/visits/{id}/route` — approve/change routing (used by doctor actions)

The `POST /api/visits` endpoint may need minor changes to accept `chief_complaint`, `intake_notes`, `routing_suggestion`, and `confidence` at creation time (currently these are updated separately during intake).

---

## Frontend Changes

### New Files

| File | Purpose |
|------|---------|
| `web/app/(dashboard)/pipeline/page.tsx` | Pipeline page (layout, polling, state) |
| `web/components/pipeline/kanban-board.tsx` | Kanban columns with visit cards |
| `web/components/pipeline/visit-card.tsx` | Individual visit card component |
| `web/components/pipeline/detail-panel.tsx` | Detail panel (stage-adaptive content) |
| `web/components/pipeline/intake-detail.tsx` | Detail panel content for intake stage |
| `web/components/pipeline/review-detail.tsx` | Detail panel content for routing/review stages |
| `web/components/pipeline/routed-detail.tsx` | Detail panel content for routed stage |
| `web/components/pipeline/department-detail.tsx` | Detail panel content for in-department stage |

### Modified Files

| File | Change |
|------|--------|
| `web/components/sidebar.tsx` | Replace Reception + Doctor Queue nav items with single "Pipeline" item |
| `web/lib/api.ts` | Add visit filtering helpers if needed |

### Removed Pages

| Page | Reason |
|------|--------|
| `web/app/(dashboard)/reception/page.tsx` | Replaced by pipeline |
| `web/app/(dashboard)/doctor/queue/page.tsx` | Replaced by pipeline |

**Note:** Reception components (`intake-chat.tsx`, `patient-selector.tsx`, `visit-info-card.tsx`) and doctor components (`visit-queue-card.tsx`, `route-approval-dialog.tsx`, `intake-viewer-dialog.tsx`) can be removed or repurposed. Some logic (route approval dialog, intake viewer) may be adapted for the pipeline detail panel.

---

## Sidebar Navigation Update

**Before:**
- Patients
- Reception
- Doctor Queue
- Agent (submenu)
- Design System

**After:**
- Patients
- Pipeline (replacing Reception + Doctor Queue)
- Agent (submenu)
- Design System

Icon: `Workflow` or `Kanban` from lucide-react.

---

## Design System Alignment

The pipeline follows the existing "Clinical Futurism" design language:
- Dark background (#0d1117, #161b22)
- Glass morphism panels (backdrop-blur, semi-transparent borders)
- Gradient accents (cyan → teal for primary actions)
- Monospace fonts for technical data (visit IDs, timestamps)
- Status colors as defined in the kanban column table above

---

## Edge Cases

1. **No active visits:** Show empty state — "No active visits. Visits will appear here when patients start conversations."
2. **Selected visit completes while viewing:** Detail panel shows completion summary, card fades from kanban (or moves to completed if toggle is on).
3. **Multiple staff viewing same pipeline:** Each user has independent selection state. Routing approval is first-come-first-served (optimistic update, server validates).
4. **Agent fails to create visit:** Chat continues normally on public page. Staff won't see a visit card. Agent should retry or inform patient of an issue.
5. **Patient abandons chat mid-intake:** Visit may not be created (agent didn't complete flow). No orphan records.

---

## Success Criteria

- [ ] Staff can see all active visits in a single kanban view
- [ ] Clicking a visit card shows stage-appropriate detail and actions
- [ ] Doctor can approve/change routing from the detail panel
- [ ] Patients can start a visit by chatting on the public page
- [ ] Agent autonomously creates patient + visit records
- [ ] Visits transition between columns in real-time (polling)
- [ ] Completed visits are hidden by default, viewable via toggle
- [ ] Existing reception and doctor queue pages are removed
- [ ] Sidebar shows single "Pipeline" navigation item
