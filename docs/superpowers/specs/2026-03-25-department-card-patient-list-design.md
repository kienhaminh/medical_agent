# Department Card Patient List

**Date:** 2026-03-25
**Status:** Approved

## Overview

Expand each department card to show the current patients in that department. Each patient appears as a row with name, chief complaint, wait time, and queue position.

## Changes

### `department-card.tsx`

**New prop:** `visits: VisitListItem[]` (patients currently `in_department` for this dept)

**Card body additions (below the ring row):**
- If `visits.length > 0`: render a `<hr>` divider then a patient list
- Show up to 5 patients, sorted by `queue_position` ascending (nulls last), tiebreaker: `created_at` ascending
- If `visits.length > 5`: show `+N more` in `text-[10px] font-mono text-[#8b949e] text-center pt-1` after the first 5
- If `visits.length === 0`: no divider, no list (card looks the same as before)

**Each patient row:**
- Patient name: `visit.patient_name`, bold, color `#c9d1d9`
- Chief complaint: `visit.chief_complaint`, truncated to 1 line, color `#8b949e`, hidden if null
- Bottom meta row: wait time on left (color from `getWaitTimeColor(visit.created_at)`, formatted with `formatTimeAgo`), queue position on right (`#N`, color `#8b949e`; hidden if `queue_position` is null)

**Grid column width:** increase `minmax` from `180px` to `220px` in `department-grid.tsx` — keep using the existing inline `style` prop (dynamic grid values cannot be expressed as static Tailwind classes without config changes; this is an established exception in the codebase)

### `department-grid.tsx`

**New prop:** `departmentVisits: Record<string, VisitListItem[]>`

Pass visits to each card:
```tsx
<DepartmentCard
  key={dept.name}
  dept={dept}
  visits={departmentVisits[dept.name] ?? []}
  onClick={() => onDeptClick(dept.name)}
/>
```

### `operations/page.tsx`

Pass `departmentVisits` to `DepartmentGrid`:
```tsx
<DepartmentGrid
  departments={departments}
  departmentVisits={departmentVisits}
  onDeptClick={setSelectedDept}
/>
```

## Data

- `VisitListItem` fields used: `visit_id` (React list key), `patient_name`, `chief_complaint` (nullable), `created_at`, `queue_position` (nullable)
- `getWaitTimeColor(createdAt)` and `formatTimeAgo(dateStr)` from `./operations-constants`
- `departmentVisits` already returned by `useOperationsDashboard` — no new API calls

## What Is Not Changing

- `use-operations-dashboard.ts` — already returns `departmentVisits`
- All dialog components
- Reception banner
- KPI bar
