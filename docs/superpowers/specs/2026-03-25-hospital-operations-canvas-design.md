# Hospital Operations Canvas

> Replaces the Kanban pipeline with a living, interactive hospital floor canvas at `/operations`.

## Problem

The current pipeline is a linear Kanban board — functional, but abstract. It doesn't reflect the spatial reality of a hospital. Staff can't see at a glance which departments are overwhelmed, how long queues are, or how patients flow between departments. We need a visualization that feels like monitoring a real hospital.

## Solution

A full-screen interactive canvas built on @xyflow/react that renders the hospital as a network of department nodes with animated patient flow, queue tails, capacity indicators, and drag-and-drop patient transfers.

## Design Decisions

| Decision | Choice | Alternatives Considered |
|----------|--------|------------------------|
| Visual metaphor | Flow network with particle system | Floor plan grid, isometric 3D campus |
| Patient queue display | Queue tail (dots lining up outside door) | Inline dots, mini list, expandable drawer |
| Patient click action | Popover card | Side panel, hover tooltip + panel |
| Relationship to Kanban | Replaces it entirely | Separate page, tabbed view |
| Pre-department stages | Single Reception building | Separate zones per stage, funnel entry |
| Patient transfers | Animated + drag-and-drop | Animated only, drag-and-drop only |
| Implementation approach | Full @xyflow/react | Custom SVG canvas, hybrid xyflow+SVG |
| Route | `/operations` | `/hospital`, `/floor`, `/pipeline` |

## Node Types

### ReceptionNode

The entry point of the hospital. Contains all pre-department visit stages.

- **Stages contained:** `intake`, `triaged`, `auto_routed`, `pending_review`, `routed`
- **Display:** Sub-stage badge counts (e.g., "3 intake · 2 awaiting review")
- **Queue tail:** Patient dots queue outside this node
- **Click action:** Opens dialog with tabbed sub-stage breakdown:
  - Intake tab: patients currently in chat (reuses `intake-detail.tsx` logic)
  - Routing tab: patients awaiting/in routing
  - Review tab: patients needing doctor review (reuses `review-detail.tsx` logic with approve/change actions)
- **Position:** Top center of canvas, visually larger than department nodes

### DepartmentNode

One per department (14 total). Represents a hospital department.

- **Display:**
  - Department name and icon
  - Capacity indicator (e.g., "2/4 beds")
  - Capacity ring showing utilization %
  - Status badge: IDLE (< 25%), OK (25-60%), BUSY (60-85%), CRITICAL (> 85%)
  - Glowing border color-coded by load (green → amber → red)
  - Pulsing animation when at CRITICAL capacity
- **Queue tail:** Patient dots line up outside the node's entrance edge
- **Click action:** Opens dialog with:
  - Full patient queue list (name, complaint, wait time, priority)
  - Department settings: capacity limit, open/close toggle
  - Assigned doctors/staff (display only — future phase)
- **Right-click:** Context menu for quick actions (Close Department, Set Capacity, View History)

### DischargeNode

Exit point at the bottom of the canvas.

- **Display:** Count of completed visits today
- **Animation:** Patients animate toward this node and fade out when visit completes

## Patient Representation

### Patient Dots

- Small circles (12-16px) rendered as React components positioned relative to their department node
- Color-coded by wait time:
  - Cyan: < 10 minutes
  - Amber: 10-30 minutes
  - Red: > 30 minutes
- Subtle pulse animation to feel "alive"

### Queue Tail Layout

- Dots line up in a single row extending outward from the department node's left edge (the "door")
- If queue > 6 patients, stack into a second row with a "+N" overflow indicator
- Queue direction is consistent (always extends left or downward) for predictable reading
- Empty departments show no tail

### Popover Card (on patient dot click)

- Floating card anchored to the dot
- Content: Patient name, visit ID, chief complaint (truncated), time waiting, status badge
- "View Details" link opens a full dialog (reusing existing detail components)
- Dismiss by clicking elsewhere

## Animations

| Event | Animation |
|-------|-----------|
| New patient arrives | Dot fades in at end of Reception queue tail |
| Patient enters department | Dot animates from queue into the node |
| Patient transfer | Dot animates along path between nodes, path glows briefly |
| Patient discharge | Dot animates toward DischargeNode, fades out |
| Department goes critical | Node border starts pulsing red |

## Custom Edges

- Animated dashed lines between Reception → Departments showing patient flow direction
- Transfer edges that light up briefly during patient movement
- Edge thickness or opacity could reflect volume (more patients routed → thicker line)

## Canvas-Level Features

### Top KPI Bar (fixed, outside xyflow viewport)

- Total active patients
- Departments at capacity count
- Average wait time across all departments
- Patients discharged today

### Built-in Controls

- Zoom/Pan via xyflow built-in controls
- MiniMap in corner showing full hospital overview
- Auto-layout positions departments in a sensible grid on first load
- Node positions are draggable and persist (localStorage or DB)

### Real-time Updates

- 5-second polling interval (consistent with current pipeline)
- Updates all node data, patient positions, and KPIs
- Optimistic UI updates for drag-and-drop transfers

## Interactions

### Drag-and-Drop Patient Transfer

1. User clicks and drags a patient dot from one department queue
2. Valid drop target departments highlight with a glow effect
3. On drop, triggers transfer API call
4. Dot animates along path from source to destination department
5. Optimistic update — dot appears in new queue immediately, confirmed by API

### Department Management

- Click department → dialog with queue list and settings
- Toggle open/close directly from dialog
- Adjust capacity limits
- View department history (future phase)

## Data Model Changes

### New: Department Model (Backend)

```python
class Department(Base):
    id: int  # primary key
    name: str  # e.g., "cardiology" (unique, matches existing constants)
    label: str  # e.g., "Cardiology" (display name)
    capacity: int  # max patients (default varies by department)
    is_open: bool  # default True
    color: str  # hex color for UI
    icon: str  # Lucide icon name
```

Seed with the 14 existing departments from `DEPARTMENTS` constant, with sensible default capacities.

### Visit Model Changes

- Add `queue_position: int` — ordering within a department queue (nullable, only set when `status = in_department`)

### New API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/departments` | GET | List all departments with current patient count and capacity |
| `/api/departments/{id}` | PATCH | Update capacity, open/close status |
| `/api/visits/{id}/transfer` | POST | Transfer patient between departments |
| `/api/hospital/stats` | GET | Aggregated KPIs for the KPI bar |

### Existing Endpoints (unchanged)

- `GET /api/visits` — list visits (used to populate patient dots)
- `POST /api/visits/{id}/route` — route a visit to department
- `POST /api/visits/{id}/check-in` — check into department
- `POST /api/visits/{id}/complete` — complete visit (triggers discharge animation)

## Frontend Data Flow

```
useHospitalCanvas() hook
  ├── GET /api/departments  →  department nodes
  ├── GET /api/visits?active=true  →  patient dots per node
  ├── GET /api/hospital/stats  →  KPI bar data
  └── polls every 5s
        ↓
  Transform to xyflow format:
    - departments → DepartmentNode[]
    - reception visits → ReceptionNode (with sub-stage counts)
    - discharged today → DischargeNode (with count)
    - routing patterns → Edge[] (Reception → Departments)
```

## Route & Navigation Changes

| Before | After |
|--------|-------|
| `/pipeline` route | `/operations` route |
| "Pipeline" sidebar label | "Operations" sidebar label |
| `Workflow` icon | `Monitor` or `Activity` icon |
| `web/components/pipeline/` folder | `web/components/operations/` folder |

## Component Structure

```
web/components/operations/
├── hospital-canvas.tsx          # Main xyflow canvas wrapper
├── canvas/
│   ├── reception-node.tsx       # ReceptionNode custom node
│   ├── department-node.tsx      # DepartmentNode custom node
│   ├── discharge-node.tsx       # DischargeNode custom node
│   ├── patient-dot.tsx          # Patient dot component
│   ├── patient-popover.tsx      # Popover card on dot click
│   ├── queue-tail.tsx           # Queue tail layout logic
│   ├── transfer-edge.tsx        # Custom animated edge
│   └── flow-edge.tsx            # Reception → Department flow edge
├── dialogs/
│   ├── reception-dialog.tsx     # Reception sub-stage tabs
│   ├── department-dialog.tsx    # Department queue + settings
│   └── patient-detail-dialog.tsx # Full patient detail (reuses existing)
├── kpi-bar.tsx                  # Top KPI stats bar
└── use-hospital-canvas.ts       # Data fetching + xyflow transform hook
```

## Files Removed

- `web/components/pipeline/kanban-board.tsx`
- `web/components/pipeline/kanban-column.tsx`
- `web/components/pipeline/visit-card.tsx`
- `web/components/pipeline/pipeline-constants.ts`

## Files Preserved & Reused

- `web/components/pipeline/intake-detail.tsx` → reused in reception-dialog.tsx
- `web/components/pipeline/review-detail.tsx` → reused in reception-dialog.tsx
- `web/components/pipeline/routed-detail.tsx` → reused in reception-dialog.tsx
- `web/components/pipeline/department-detail.tsx` → adapted for department-dialog.tsx

## Success Criteria

1. Canvas renders all 14 departments + Reception + Discharge as interactive nodes
2. Patient dots appear in correct queue tails with wait-time color coding
3. Clicking a patient dot shows a popover with correct patient info
4. Dragging a patient between departments triggers a transfer and animates
5. Department click opens dialog with queue list and capacity settings
6. KPI bar shows accurate real-time stats
7. 5-second polling keeps all data current
8. Zoom, pan, and minimap work correctly
9. Canvas replaces the Kanban at `/operations` with no loss of functionality
10. All existing pipeline actions (route, review, check-in, complete) are accessible through the canvas UI
