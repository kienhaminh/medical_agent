# Rooms by Department — Design Spec

**Date:** 2026-04-03  
**Status:** Approved

## Overview

Add physical clinical exam rooms to the operations dashboard. Each room belongs to a department and holds at most one patient at a time. The agent automatically assigns an empty room when routing a patient to a department; if no room is available, the patient falls into the department queue. The `/operations` page shows department cards that expand to reveal their rooms.

## Goals

- Demonstrate agent orchestration: agent assigns patients to specific rooms in real time.
- Operations dashboard reflects live room occupancy, grouped by department.
- Department cards expand inline to show room tiles (occupied or empty).

## Data Model

**New `rooms` table:**

| Column | Type | Notes |
|---|---|---|
| `id` | int PK | auto-increment |
| `room_number` | string | unique, e.g. "101" |
| `department_name` | string FK | references `departments.name` |
| `current_visit_id` | int FK nullable | references `visits.id`; null = empty |

A room is "occupied" when `current_visit_id` is set. One visit per room at a time.

## Backend API

### New endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/rooms` | List all rooms with occupancy. Response includes `patient_name` joined from visit. |
| `POST` | `/rooms` | Create a room. Body: `{ room_number, department_name }`. |
| `PATCH` | `/rooms/{room_number}` | Assign or unassign a visit. Body: `{ current_visit_id: int | null }`. |

### `GET /rooms` response shape

```json
[
  {
    "id": 1,
    "room_number": "101",
    "department_name": "ent",
    "current_visit_id": 42,
    "patient_name": "John Doe"
  },
  {
    "id": 2,
    "room_number": "102",
    "department_name": "ent",
    "current_visit_id": null,
    "patient_name": null
  }
]
```

## Agent Routing Logic Change

When the agent routes a visit to a department:

1. Query empty rooms in that department (`current_visit_id IS NULL`).
2. If one or more empty rooms exist → assign the visit to the first empty room (ordered by `room_number` ascending) via `PATCH /rooms/{room_number}`.
3. If no empty rooms → leave the visit in the department queue (existing behavior, `in_department` status, no room assigned).

Room assignment is cleared automatically when a visit is discharged or transferred.

## Frontend

### New API type (`web/lib/api.ts`)

```ts
export interface RoomInfo {
  id: number;
  room_number: string;
  department_name: string;
  current_visit_id: number | null;
  patient_name: string | null;
}

export async function listRooms(): Promise<RoomInfo[]>
```

### `useOperationsDashboard` hook

Add `listRooms()` to the parallel `Promise.all` fetch. Expose `rooms: RoomInfo[]` from the hook.

### `DepartmentCard` — expandable rooms section

- Card header retains existing stats (status badge, patient count, queue length).
- Header has a chevron toggle. Clicking the chevron expands/collapses the rooms section.
- Clicking the department name/title opens the existing `DepartmentDialog` (unchanged behavior).
- Rooms section shows a mini grid of room tiles:

```
┌─────────────────────────────────────┐
│ ENT  ● OK  2/4 patients       [v]   │  ← header; [v] = expand toggle
├─────────────────────────────────────┤
│  [101 · John Doe]  [102 · —      ]  │
│  [103 · —       ]  [104 · Jane S.]  │
└─────────────────────────────────────┘
```

**Room tile states:**
- **Occupied** (amber background): shows `{room_number} · {patient_name}`. Clicking opens `DepartmentDialog` filtered to that visit.
- **Empty** (muted/green outline): shows `{room_number} · —`. Not clickable.

### `DepartmentGrid`

No structural changes. Passes `rooms` filtered by department down to each `DepartmentCard`.

## Out of Scope

- Room creation/deletion UI (rooms seeded via backend directly or admin API).
- Room-level capacity (always 1).
- Drag-and-drop room reassignment.
