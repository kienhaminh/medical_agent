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

1. **Public page `/`** (patient-facing) — the existing reception chat page at `web/app/page.tsx`. Currently a simple chat UI that calls `POST /api/chat`. No changes to the page itself — the intelligence is in the agent's system prompt and tools. The agent handles identification, patient creation, and visit creation entirely through conversation + tool calls.
2. **Staff pipeline `/pipeline`** (new, auth-required) — Kanban + Detail Panel

### Data Flow

```
Patient starts chat on / (public reception chat)
  → Agent greets, collects name, DOB, gender, symptoms
  → Agent calls find_patient tool (search by name + DOB)
  → If no match: agent calls create_patient tool (auto-creates record)
  → Agent creates visit via POST /api/visits (status: intake)
  → Visit appears on staff pipeline kanban in Intake column
  → Agent continues conversation, gathers symptoms
  → Agent calls complete_triage tool (existing tool)
    → Sets chief_complaint, intake_notes, routing_suggestion, confidence
    → Status transitions to auto_routed (≥0.7) or pending_review (<0.7)
  → Visit card moves to Routing or Needs Review column
  → Staff monitors, reviews, approves routing
```

### Chat Session & patient_id Flow

The public chat at `/` starts without a `patient_id`. The agent's first task is to identify the patient through conversation. Once the agent calls `create_patient` or `find_patient`, it has a `patient_id` to use for `create_visit`. The chat session is created when the visit is created (existing behavior in `POST /api/visits`). Subsequent messages in the same browser session are linked to this chat session via the `session_id` returned from visit creation.

---

## Staff Pipeline Page (`/pipeline`)

### Layout: Kanban + Detail Panel

- **Left (flex: 2):** Kanban columns showing visit cards
- **Right (flex: 1.5):** Detail panel for selected visit
- **Header:** Page title, active visit count, "Show Completed" toggle

### Kanban Columns

| Column | Status(es) | Color | Description |
|--------|-----------|-------|-------------|
| Intake | `intake` | Cyan (#00d9ff) | Agent chatting with patient |
| Routing | `auto_routed` | Purple (#a78bfa) | Agent finished, confidence ≥ 0.7 |
| Needs Review | `pending_review` | Amber (#f59e0b) | Confidence < 0.7, doctor must act |
| Routed | `routed` | Green (#10b981) | Doctor approved routing |
| In Department | `in_department` | Indigo (#6366f1) | Patient receiving specialist care |

**`triaged` status:** The `VisitStatus.TRIAGED` enum value exists in the model but is not used in the current codebase — `complete_triage` transitions directly from `intake` to `auto_routed`/`pending_review`. Any visits with `triaged` status (e.g., from seed data) will be mapped to the **Intake** column as a fallback. No schema migration needed.

**Completed visits** are hidden by default. A "Show Completed" toggle in the header reveals a collapsed Completed column.

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
- "Check In to Department" button → transitions to `in_department`

**In Department stage:**
- Patient info summary
- Department assignment
- Routing history
- "Complete Visit" button → transitions to `completed`
- Placeholder for specialist notes (future)

**Empty state (no visit selected):**
- "Select a visit to view details" message

### Polling & Real-time Updates

- Polls `GET /api/visits?exclude_status=completed` every 5 seconds
- Preserves selected visit when data refreshes
- New visits animate into the Intake column
- Cards moving between columns animate the transition

---

## Backend Changes

### Agent Tools

**Existing tool — `complete_triage` (no changes):**
Already handles the triage completion flow. Located at `src/tools/builtin/complete_triage_tool.py`. Accepts `id`, `chief_complaint`, `intake_notes`, `routing_suggestion`, `confidence`. Transitions visit from `intake` to `auto_routed`/`pending_review`.

**New tool — `find_patient`:**
- Input: `name` (string), `dob` (string, optional)
- Output: List of matching patients (id, name, dob, gender) or empty array
- Searches by name (case-insensitive partial match), filters by DOB if provided
- Registered as `scope="assignable"` in the tool registry

**New tool — `create_patient`:**
- Input: `name` (string), `dob` (string), `gender` (string)
- Output: Created patient record with ID
- Agent calls this when find_patient returns no matches
- Registered as `scope="assignable"` in the tool registry

### Agent System Prompt Update

The reception triage agent's system prompt is updated to guide the autonomous intake flow:

1. Greet the patient warmly
2. Collect: full name, date of birth, gender
3. Search for existing patient record (`find_patient`)
4. If not found, create new patient record (`create_patient`)
5. Create a visit for this patient (the visit creation is handled via the existing `POST /api/visits` endpoint, called as a tool)
6. Ask about symptoms, chief complaint, duration, severity
7. Reason about appropriate department routing
8. Complete triage with routing suggestion and confidence score (`complete_triage`)
9. Inform the patient that their information has been recorded and they will be seen

### API Changes

**Modified endpoints:**

**`GET /api/visits` — add multi-status filtering and patient name:**
- New query parameter: `exclude_status` (string, optional) — exclude visits with this status (e.g., `completed`)
- Alternatively: `status_in` (comma-separated string, optional) — filter to multiple statuses
- Response model change: `VisitResponse` enriched with `patient_name` field (join with patients table). This avoids N+1 queries from the frontend fetching each visit's detail individually.

**New endpoints:**

**`PATCH /api/visits/{visit_id}/check-in` — transition to in_department:**
- Validates visit is in `routed` status
- Sets status to `in_department`
- Returns updated visit

**`PATCH /api/visits/{visit_id}/complete` — transition to completed:**
- Validates visit is in `in_department` status
- Sets status to `completed`
- Returns updated visit

**Existing endpoints (no changes needed):**
- `POST /api/patients` — create patient (used by agent tool)
- `GET /api/patients` — search patients (used by agent tool)
- `POST /api/visits` — create visit (used by agent tool, already creates with `intake` status)
- `GET /api/visits/{id}` — get visit detail (used by detail panel)
- `PATCH /api/visits/{id}/route` — approve/change routing (used by doctor actions, already validates status)

**Concurrency note:** The `PATCH /api/visits/{id}/route` endpoint already validates that the visit is in `auto_routed` or `pending_review` status before allowing routing. If two doctors try to approve simultaneously, the second will receive a 400 error because the visit will already be in `routed` status. This is adequate concurrency control for the current scale.

---

## Frontend Changes

### New Files

| File | Purpose |
|------|---------|
| `web/app/(dashboard)/pipeline/page.tsx` | Pipeline page (layout, polling, state) |
| `web/components/pipeline/pipeline-constants.ts` | Shared status colors, column definitions, status-to-column mapping |
| `web/components/pipeline/kanban-board.tsx` | Kanban columns with visit cards |
| `web/components/pipeline/visit-card.tsx` | Individual visit card component |
| `web/components/pipeline/detail-panel.tsx` | Detail panel (stage-adaptive content, delegates to sub-components) |
| `web/components/pipeline/intake-detail.tsx` | Detail panel content for intake stage |
| `web/components/pipeline/review-detail.tsx` | Detail panel content for routing/review stages |
| `web/components/pipeline/routed-detail.tsx` | Detail panel content for routed stage |
| `web/components/pipeline/department-detail.tsx` | Detail panel content for in-department stage |

### Modified Files

| File | Change |
|------|--------|
| `web/components/sidebar.tsx` | Replace Reception + Doctor Queue nav items with single "Pipeline" item |
| `web/lib/api.ts` | Add `listActiveVisits()` helper (calls with `exclude_status=completed`), add `checkInVisit()`, `completeVisit()` API functions |
| `web/lib/types.ts` | Update `Visit` type to include `patient_name` field |

### Removed Pages

| Page | Reason |
|------|--------|
| `web/app/(dashboard)/reception/page.tsx` | Replaced by pipeline |
| `web/app/(dashboard)/doctor/queue/page.tsx` | Replaced by pipeline |

**Components to remove:** `reception/patient-selector.tsx`, `reception/visit-info-card.tsx`, `doctor/visit-queue-card.tsx`.

**Components to repurpose:** `doctor/route-approval-dialog.tsx` (adapt for pipeline detail panel), `doctor/intake-viewer-dialog.tsx` (adapt for intake transcript view), `reception/intake-chat.tsx` (adapt read-only version for pipeline detail panel).

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

Icon: `Workflow` from lucide-react.

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
3. **Multiple staff viewing same pipeline:** Each user has independent selection state. Routing approval is first-come-first-served — the `PATCH /route` endpoint validates status before allowing updates, so the second approver gets a 400 error. Frontend handles this gracefully by refreshing and showing a toast notification.
4. **Agent fails to create visit:** Chat continues normally on public page. Staff won't see a visit card. Agent should retry or inform patient of an issue.
5. **Patient abandons chat mid-intake:** If visit was already created, it remains in `intake` status on the kanban. Staff can see stale intake visits and manually complete or cancel them. If visit was not yet created, no orphan records.
6. **Visits with `triaged` status:** Mapped to the Intake column as a fallback. This status is not actively used in the codebase.
7. **Public chat starts without patient_id:** Expected behavior. The agent identifies the patient through conversation, then creates the visit. Messages before visit creation are ephemeral (not linked to a chat session). Once the visit is created, subsequent messages use the visit's `intake_session_id`.

---

## Success Criteria

- [ ] Staff can see all active visits in a single kanban view
- [ ] Clicking a visit card shows stage-appropriate detail and actions
- [ ] Doctor can approve/change routing from the detail panel
- [ ] Staff can check in a visit to department and complete it
- [ ] Patients can start a visit by chatting on the public page
- [ ] Agent autonomously creates patient + visit records via tools
- [ ] Agent completes triage via existing `complete_triage` tool
- [ ] Visits transition between columns in real-time (polling)
- [ ] Completed visits are hidden by default, viewable via toggle
- [ ] Existing reception and doctor queue pages are removed
- [ ] Sidebar shows single "Pipeline" navigation item
- [ ] `GET /api/visits` returns patient_name and supports multi-status filtering
