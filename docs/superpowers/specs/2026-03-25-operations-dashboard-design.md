# Operations Dashboard Redesign

**Date:** 2026-03-25
**Status:** Approved

## Overview

Replace the ReactFlow canvas on the Operations page with a simple, interactive dashboard that gives users an at-a-glance overview of all department statuses. Dialogs and data fetching remain unchanged.

## Layout

```
┌─────────────────────────────────────────────────┐
│  KPI Bar (active patients, at-capacity, wait, discharged) │
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
├─────────────────────────────────────────────────┤
│  Discharged today: N                             │
└─────────────────────────────────────────────────┘
```

## Components

### New files

| File | Purpose |
|------|---------|
| `use-operations-dashboard.ts` | Simplified data hook — polls every 5s, fetches departments + visits + stats, groups visits by department. No position/node/edge logic. |
| `reception-banner.tsx` | Full-width clickable card. Shows `RECEPTION` label + three count badges (intake, routing, review). Pulse animation when review count > 0. Opens reception dialog on click. |
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
- Three badges: `intake: N` (blue), `routing: N` (violet), `review: N` (amber)
- Entire card is clickable → opens reception dialog
- Subtle pulse/glow animation on border when `review` count > 0

### `department-card.tsx`

- **Header**: department label colored by `dept.color`, status badge (IDLE/OK/BUSY/CRITICAL)
- **Body**: utilization ring (SVG circle) + `X/Y slots` text
- **Footer**: `N in queue` if queue > 0, otherwise empty
- **Closed state**: dimmed opacity, `CLOSED` badge replaces status badge
- **Border**: subtly tinted by status color (e.g. `border-red-500/30` for CRITICAL)
- Click anywhere → opens department dialog

### `use-operations-dashboard.ts`

- Replaces `use-hospital-canvas.ts`
- Polls `listDepartments()`, `listActiveVisits()`, `getHospitalStats()` every 5s
- Computes `receptionVisits` (filtered by RECEPTION_STATUSES)
- Computes `departmentVisits` (grouped by `current_department`)
- Returns: `{ departments, stats, receptionVisits, departmentVisits, loading, error, refresh }`
- No localStorage, no position tracking, no node/edge building

### Discharge footer

- Single line below the grid: `Discharged today: N` in muted monospace text

## Data Flow

```
useOperationsDashboard (polls 5s)
  ├── listDepartments()    → departments[]
  ├── listActiveVisits()   → receptionVisits[], departmentVisits{}
  └── getHospitalStats()   → stats{}

OperationsPage
  ├── KpiBar              ← stats
  ├── ReceptionBanner     ← receptionVisits → opens ReceptionDialog
  ├── DepartmentGrid
  │   └── DepartmentCard  ← dept + departmentVisits[dept.name] → opens DepartmentDialog
  └── Discharge footer    ← stats.discharged_today
```

## What Is Not Changing

- All dialog components and their internal logic
- API calls and data types
- KPI bar
- Status colors and constants
- 5-second polling interval
