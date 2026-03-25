# Operations Dashboard Redesign

**Date:** 2026-03-25
**Status:** Approved

## Overview

Replace the ReactFlow canvas on the Operations page with a simple, interactive dashboard that gives users an at-a-glance overview of all department statuses. Dialogs and data fetching remain unchanged.

## Layout

```
┌─────────────────────────────────────────────────┐
│  KPI Bar (active patients, at-capacity, wait, discharged today) │
├─────────────────────────────────────────────────┤
│  RECEPTION banner (full width, clickable)        │
│  [ intake: N ]  [ routing: N ]  [ review: N ]   │
├─────────────────────────────────────────────────┤
│  Department grid (responsive, 4–7 columns)       │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐         │
│  │Cardiology│ │Emergency │ │  ENT     │  ...    │
│  │  IDLE    │ │  BUSY    │ │  OK      │         │
│  │ ◯ 0/4   │ │ ◯ 4/6   │ │ ◯ 1/2   │         │
│  └──────────┘ └──────────┘ └──────────┘         │
└─────────────────────────────────────────────────┘
```

Note: `KpiBar` already shows `discharged_today` — no separate discharge footer is needed.

## Components

### New files

| File | Purpose |
|------|---------|
| `use-operations-dashboard.ts` | Simplified data hook — polls every 5s, fetches departments + visits + stats, groups visits by department. No position/node/edge logic. |
| `reception-banner.tsx` | Full-width clickable card. Shows `RECEPTION` label + three count badges (intake, routing, review). Pulse animation when `pendingReviewCount > 0`. Opens reception dialog on click. |
| `department-card.tsx` | Single department card. Shows label (tinted by dept color), status badge, utilization ring (SVG), `X/Y slots`, queue count if > 0. Click → opens department dialog. Closed departments are dimmed with a CLOSED badge. |
| `department-grid.tsx` | Responsive CSS grid wrapper. Renders all department cards sorted alphabetically. |

### Files kept unchanged

- `kpi-bar.tsx`
- `operations-constants.ts`
- `dialogs/reception-dialog.tsx`
- `dialogs/department-dialog.tsx`
- `dialogs/review-detail.tsx`
- All other dialog components

### Files deleted

- `hospital-canvas.tsx`
- `use-hospital-canvas.ts`
- `canvas/` subfolder (all node/edge/flow components)

## Component Details

### `reception-banner.tsx`

- Dark card spanning full width
- Label: `RECEPTION` in monospace caps
- Three badges with explicit status mappings:
  - `intake: N` (blue) — visits with status `"intake"` or `"triaged"`
  - `routing: N` (violet) — visits with status `"auto_routed"`
  - `review: N` (amber) — visits with status `"pending_review"` or `"routed"` (`"routed"` is included because the patient is assigned but not yet checked in to a department — still actionable in reception)
- Entire card is clickable → opens reception dialog
- Subtle pulse/glow animation on border when `review` count > 0 (i.e. `["pending_review","routed"]` visits exist)
- Props: `visits: VisitListItem[]`, `onClick: () => void`

### `department-card.tsx`

- **Header**: department label colored by `dept.color`, status badge (IDLE/OK/BUSY/CRITICAL); if `!dept.is_open`, show `CLOSED` badge with dimmed opacity instead
- **Body**: utilization ring (SVG circle) + `X/Y slots` text
  - `X` = `dept.current_patient_count` (from `DepartmentInfo`, not derived from visits array)
  - `Y` = `dept.capacity`
  - If `dept.capacity === 0`, render the ring as empty/gray (avoid division by zero)
- **Footer**: `N in queue` using `dept.queue_length` if > 0, otherwise empty
- **Border**: subtly tinted by status color (e.g. `border-red-500/30` for CRITICAL)
- Click anywhere → calls `onClick` prop (dialog state lives in the page, not inside the card)
- Props: `dept: DepartmentInfo`, `onClick: () => void`

### `department-grid.tsx`

- Renders `DepartmentCard` for each department, sorted alphabetically by `dept.label`
- Creates a closure per card: `<DepartmentCard onClick={() => onDeptClick(dept.name)} />`
- Props: `departments: DepartmentInfo[]`, `onDeptClick: (deptName: string) => void`

### `use-operations-dashboard.ts`

- Replaces `use-hospital-canvas.ts`
- Polls `listDepartments()`, `listActiveVisits()`, `getHospitalStats()` every 5s
- `receptionVisits`: visits filtered by `RECEPTION_STATUSES` (`["intake","triaged","auto_routed","pending_review","routed"]`)
- `departmentVisits`: `Record<string, VisitListItem[]>` — visits with `status === "in_department"` grouped by `visit.current_department` (join key: `dept.name === visit.current_department`)
- Returns: `{ departments, stats, receptionVisits, departmentVisits, loading, error, refresh }`
- No localStorage, no position tracking, no node/edge building

## Loading & Error States

These are handled at the page level (same as today):
- `loading === true` → full-page centered spinner: `"Loading hospital data..."`
- `error !== null` → full-page centered error message in red
- Both states render instead of the dashboard content

## Data Flow & Dialog State

Dialog state lives in `OperationsPage` (consistent with current design):

```
useOperationsDashboard (polls 5s)
  ├── listDepartments()    → departments[]
  ├── listActiveVisits()   → receptionVisits[], departmentVisits{}
  └── getHospitalStats()   → stats{}

OperationsPage
  ├── state: receptionOpen (bool), selectedDept (string | null)
  ├── KpiBar              ← stats
  ├── ReceptionBanner     ← receptionVisits, onClick → setReceptionOpen(true)
  ├── DepartmentGrid      ← departments, onDeptClick → setSelectedDept(name)
  │   └── DepartmentCard  ← dept, onClick={() => onDeptClick(dept.name)}
  ├── ReceptionDialog     ← open=receptionOpen, visits=receptionVisits,
  │                          onVisitUpdated={refresh}
  └── DepartmentDialog    ← open=!!selectedDept, department=selectedDepartment,
                             visits=departmentVisits[selectedDept ?? ""] ?? [],
                             onUpdated={refresh}
```

## Additional Cleanup

- Remove `Reset Layout` button from `OperationsPage` (tied to canvas `resetPositions`, no longer relevant)
- Delete `CANVAS_LAYOUT` constant block from `operations-constants.ts` (canvas-specific, unused after migration)

## What Is Not Changing

- All dialog components and their internal logic
- API calls and data types (`DepartmentInfo`, `VisitListItem`, `HospitalStats`)
- `KpiBar`
- Status colors, wait-time helpers, and other constants in `operations-constants.ts`
- 5-second polling interval
