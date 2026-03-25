# Operations Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the ReactFlow canvas on the Operations page with a simple interactive dashboard of department status cards and a prominent reception banner.

**Architecture:** A new data hook (`use-operations-dashboard.ts`) replaces the canvas hook — same polling, no position/node/edge logic. Three new presentational components (ReceptionBanner, DepartmentCard, DepartmentGrid) replace the canvas. Dialog state stays in the page. All existing dialog components are untouched.

**Tech Stack:** Next.js 14 (App Router), React, TypeScript, Tailwind CSS, shadcn/ui

---

## File Map

| Action | File |
|--------|------|
| **Create** | `web/components/operations/use-operations-dashboard.ts` |
| **Create** | `web/components/operations/reception-banner.tsx` |
| **Create** | `web/components/operations/department-card.tsx` |
| **Create** | `web/components/operations/department-grid.tsx` |
| **Modify** | `web/app/(dashboard)/operations/page.tsx` |
| **Modify** | `web/components/operations/operations-constants.ts` (delete `CANVAS_LAYOUT`) |
| **Delete** | `web/components/operations/hospital-canvas.tsx` |
| **Delete** | `web/components/operations/use-hospital-canvas.ts` |
| **Delete** | `web/components/operations/canvas/` (entire folder) |

---

## Task 1: Create `use-operations-dashboard.ts`

**Files:**
- Create: `web/components/operations/use-operations-dashboard.ts`

This hook replaces `use-hospital-canvas.ts`. It polls the same three API endpoints every 5 seconds and returns grouped visit data — no ReactFlow nodes, edges, or localStorage.

- [ ] **Step 1: Create the hook file**

```typescript
// web/components/operations/use-operations-dashboard.ts
"use client";

import { useCallback, useEffect, useState } from "react";
import {
  listDepartments,
  listActiveVisits,
  getHospitalStats,
  type DepartmentInfo,
  type HospitalStats,
  type VisitListItem,
} from "@/lib/api";
import { RECEPTION_STATUSES } from "./operations-constants";

export interface DashboardData {
  departments: DepartmentInfo[];
  stats: HospitalStats;
  receptionVisits: VisitListItem[];
  departmentVisits: Record<string, VisitListItem[]>;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

const POLL_INTERVAL = 5000;

export function useOperationsDashboard(): DashboardData {
  const [departments, setDepartments] = useState<DepartmentInfo[]>([]);
  const [visits, setVisits] = useState<VisitListItem[]>([]);
  const [stats, setStats] = useState<HospitalStats>({
    active_patients: 0,
    departments_at_capacity: 0,
    avg_wait_minutes: 0,
    discharged_today: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const [depts, vis, st] = await Promise.all([
        listDepartments(),
        listActiveVisits(),
        getHospitalStats(),
      ]);
      setDepartments(depts);
      setVisits(vis);
      setStats(st);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchData]);

  const receptionVisits = visits.filter((v) =>
    (RECEPTION_STATUSES as readonly string[]).includes(v.status)
  );

  const departmentVisits: Record<string, VisitListItem[]> = {};
  visits
    .filter((v) => v.status === "in_department" && v.current_department)
    .forEach((v) => {
      const dept = v.current_department!;
      if (!departmentVisits[dept]) departmentVisits[dept] = [];
      departmentVisits[dept].push(v);
    });

  return {
    departments,
    stats,
    receptionVisits,
    departmentVisits,
    loading,
    error,
    refresh: fetchData,
  };
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd /Users/kien.ha/Code/medical_agent/web && npx tsc --noEmit`
Expected: No errors related to the new file.

- [ ] **Step 3: Commit**

```bash
git add web/components/operations/use-operations-dashboard.ts
git commit -m "feat: add useOperationsDashboard hook (replaces canvas hook)"
```

---

## Task 2: Create `reception-banner.tsx`

**Files:**
- Create: `web/components/operations/reception-banner.tsx`

Full-width clickable card showing RECEPTION label with intake/routing/review count badges. Pulses when review > 0.

- [ ] **Step 1: Create the component**

```tsx
// web/components/operations/reception-banner.tsx
"use client";

import type { VisitListItem } from "@/lib/api";

interface ReceptionBannerProps {
  visits: VisitListItem[];
  onClick: () => void;
}

export function ReceptionBanner({ visits, onClick }: ReceptionBannerProps) {
  const intakeCount = visits.filter(
    (v) => v.status === "intake" || v.status === "triaged"
  ).length;
  const routingCount = visits.filter((v) => v.status === "auto_routed").length;
  const reviewCount = visits.filter(
    (v) => v.status === "pending_review" || v.status === "routed"
  ).length;

  const hasReview = reviewCount > 0;

  return (
    <button
      onClick={onClick}
      className={`w-full text-left rounded-xl border px-6 py-4 transition-all hover:brightness-110 focus:outline-none ${hasReview ? "animate-pulse" : ""}`}
      style={{
        background: "rgba(0, 217, 255, 0.06)",
        borderColor: hasReview
          ? "rgba(245, 158, 11, 0.6)"
          : "rgba(0, 217, 255, 0.4)",
        boxShadow: hasReview
          ? "0 0 20px rgba(245, 158, 11, 0.15)"
          : "0 0 15px rgba(0, 217, 255, 0.1)",
      }}
    >
      <div className="text-sm font-bold font-mono text-[#00d9ff] mb-3 tracking-widest">
        RECEPTION
      </div>
      <div className="flex items-center gap-4 text-[12px] font-mono">
        <span
          className="px-2.5 py-1 rounded-full"
          style={{
            color: "#00d9ff",
            background: "rgba(0, 217, 255, 0.12)",
            border: "1px solid rgba(0, 217, 255, 0.25)",
          }}
        >
          intake: {intakeCount}
        </span>
        <span
          className="px-2.5 py-1 rounded-full"
          style={{
            color: "#a78bfa",
            background: "rgba(167, 139, 250, 0.12)",
            border: "1px solid rgba(167, 139, 250, 0.25)",
          }}
        >
          routing: {routingCount}
        </span>
        <span
          className="px-2.5 py-1 rounded-full"
          style={{
            color: hasReview ? "#f59e0b" : "#8b949e",
            background: hasReview
              ? "rgba(245, 158, 11, 0.12)"
              : "rgba(139, 148, 158, 0.08)",
            border: hasReview
              ? "1px solid rgba(245, 158, 11, 0.3)"
              : "1px solid rgba(139, 148, 158, 0.15)",
          }}
        >
          review: {reviewCount}
        </span>
        {visits.length === 0 && (
          <span className="text-[#8b949e]">No patients in reception</span>
        )}
      </div>
    </button>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd /Users/kien.ha/Code/medical_agent/web && npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add web/components/operations/reception-banner.tsx
git commit -m "feat: add ReceptionBanner component"
```

---

## Task 3: Create `department-card.tsx`

**Files:**
- Create: `web/components/operations/department-card.tsx`

Single department card with status badge, utilization ring (SVG), slot count, queue count. Handles the `capacity === 0` edge case and closed state.

- [ ] **Step 1: Create the component**

```tsx
// web/components/operations/department-card.tsx
"use client";

import type { DepartmentInfo } from "@/lib/api";
import { DEPARTMENT_STATUS_COLORS } from "./operations-constants";

interface DepartmentCardProps {
  dept: DepartmentInfo;
  onClick: () => void;
}

// Circumference of r=20 circle
const CIRCUMFERENCE = 125.66;

export function DepartmentCard({ dept, onClick }: DepartmentCardProps) {
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

  return (
    <button
      onClick={onClick}
      className="w-full text-left rounded-xl border px-4 py-3 transition-all hover:brightness-110 focus:outline-none"
      style={{
        background: isClosed ? "rgba(255,255,255,0.02)" : `${statusColor}08`,
        borderColor: isClosed ? "rgba(255,255,255,0.08)" : `${statusColor}40`,
        boxShadow: isCritical ? `0 0 20px ${statusColor}30` : "none",
        opacity: isClosed ? 0.55 : 1,
        animation: isCritical ? "pulse 1.5s ease-in-out infinite" : "none",
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-2 mb-3">
        <span
          className="text-sm font-bold font-mono truncate"
          style={{ color: isClosed ? "#8b949e" : statusColor }}
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
          {/* Background track */}
          <circle
            cx="22" cy="22" r="20"
            fill="none"
            stroke={isClosed ? "rgba(255,255,255,0.06)" : `${statusColor}20`}
            strokeWidth="3"
          />
          {/* Filled arc — skip if capacity is 0 */}
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
          <text
            x="22" y="22"
            textAnchor="middle"
            dominantBaseline="central"
            fill={isClosed ? "#6b7280" : statusColor}
            fontSize="10"
            fontFamily="monospace"
          >
            {dept.capacity > 0 ? `${utilization}%` : "—"}
          </text>
        </svg>

        <div className="min-w-0">
          <div className="text-xs font-mono text-[#8b949e]">
            {dept.current_patient_count}/{dept.capacity} slots
          </div>
          {dept.queue_length > 0 && (
            <div className="text-[10px] font-mono text-[#f59e0b] mt-0.5">
              {dept.queue_length} in queue
            </div>
          )}
        </div>
      </div>
    </button>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd /Users/kien.ha/Code/medical_agent/web && npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add web/components/operations/department-card.tsx
git commit -m "feat: add DepartmentCard component"
```

---

## Task 4: Create `department-grid.tsx`

**Files:**
- Create: `web/components/operations/department-grid.tsx`

Responsive CSS grid wrapper. Sorts departments alphabetically by label, creates a closure per card to pass the dept name up to the page.

- [ ] **Step 1: Create the component**

```tsx
// web/components/operations/department-grid.tsx
"use client";

import type { DepartmentInfo } from "@/lib/api";
import { DepartmentCard } from "./department-card";

interface DepartmentGridProps {
  departments: DepartmentInfo[];
  onDeptClick: (deptName: string) => void;
}

export function DepartmentGrid({ departments, onDeptClick }: DepartmentGridProps) {
  const sorted = [...departments].sort((a, b) => a.label.localeCompare(b.label));

  if (sorted.length === 0) {
    return (
      <div className="flex items-center justify-center py-16 text-[#8b949e] font-mono text-sm">
        No departments configured
      </div>
    );
  }

  return (
    <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))" }}>
      {sorted.map((dept) => (
        <DepartmentCard
          key={dept.name}
          dept={dept}
          onClick={() => onDeptClick(dept.name)}
        />
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd /Users/kien.ha/Code/medical_agent/web && npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add web/components/operations/department-grid.tsx
git commit -m "feat: add DepartmentGrid component"
```

---

## Task 5: Rewrite `page.tsx` to use new components

**Files:**
- Modify: `web/app/(dashboard)/operations/page.tsx`

Replace canvas imports and wiring with the new hook and components. Dialog state stays exactly where it is.

- [ ] **Step 1: Rewrite page.tsx**

```tsx
// web/app/(dashboard)/operations/page.tsx
"use client";

import { useCallback, useState } from "react";
import { useOperationsDashboard } from "@/components/operations/use-operations-dashboard";
import { KpiBar } from "@/components/operations/kpi-bar";
import { ReceptionBanner } from "@/components/operations/reception-banner";
import { DepartmentGrid } from "@/components/operations/department-grid";
import { ReceptionDialog } from "@/components/operations/dialogs/reception-dialog";
import { DepartmentDialog } from "@/components/operations/dialogs/department-dialog";

export default function OperationsPage() {
  const [receptionOpen, setReceptionOpen] = useState(false);
  const [selectedDept, setSelectedDept] = useState<string | null>(null);

  const { departments, stats, receptionVisits, departmentVisits, loading, error, refresh } =
    useOperationsDashboard();

  const handleDeptClick = useCallback((deptName: string) => {
    setSelectedDept(deptName);
  }, []);

  const selectedDepartment = departments.find((d) => d.name === selectedDept) ?? null;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-[#8b949e] font-mono text-sm">Loading hospital data...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-red-400 font-mono text-sm">{error}</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* KPI bar */}
      <div className="border-b border-white/[0.06]">
        <KpiBar stats={stats} />
      </div>

      {/* Dashboard content */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Reception banner */}
        <ReceptionBanner
          visits={receptionVisits}
          onClick={() => setReceptionOpen(true)}
        />

        {/* Department grid */}
        <DepartmentGrid
          departments={departments}
          onDeptClick={handleDeptClick}
        />
      </div>

      {/* Dialogs */}
      <ReceptionDialog
        open={receptionOpen}
        onOpenChange={setReceptionOpen}
        visits={receptionVisits}
        departments={departments}
        onVisitUpdated={refresh}
      />

      <DepartmentDialog
        open={!!selectedDept}
        onOpenChange={(open) => !open && setSelectedDept(null)}
        department={selectedDepartment}
        visits={selectedDept ? (departmentVisits[selectedDept] ?? []) : []}
        onUpdated={refresh}
      />
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd /Users/kien.ha/Code/medical_agent/web && npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add web/app/(dashboard)/operations/page.tsx
git commit -m "feat: replace canvas with operations dashboard in page"
```

---

## Task 6: Cleanup — delete canvas files and remove CANVAS_LAYOUT

**Files:**
- Delete: `web/components/operations/hospital-canvas.tsx`
- Delete: `web/components/operations/use-hospital-canvas.ts`
- Delete: `web/components/operations/canvas/` (entire folder)
- Modify: `web/components/operations/operations-constants.ts` (remove `CANVAS_LAYOUT` block)

- [ ] **Step 1: Delete canvas files**

```bash
rm web/components/operations/hospital-canvas.tsx
rm web/components/operations/use-hospital-canvas.ts
rm -rf web/components/operations/canvas/
```

- [ ] **Step 2: Remove CANVAS_LAYOUT from operations-constants.ts**

Open `web/components/operations/operations-constants.ts` and delete these lines:

```typescript
/** Default canvas layout positions. */
export const CANVAS_LAYOUT = {
  RECEPTION_Y: 50,
  DEPARTMENT_START_Y: 250,
  DEPARTMENT_ROW_GAP: 260,
  DEPARTMENT_COL_GAP: 240,
  DEPARTMENTS_PER_ROW: 7,
  DISCHARGE_Y: 850,
  CENTER_X: 820,
} as const;
```

- [ ] **Step 3: Verify TypeScript compiles clean**

Run: `cd /Users/kien.ha/Code/medical_agent/web && npx tsc --noEmit`
Expected: No errors. If any remaining file imports from `hospital-canvas`, `use-hospital-canvas`, or the `canvas/` subfolder, fix those imports now.

- [ ] **Step 4: Verify the app builds**

Run: `cd /Users/kien.ha/Code/medical_agent/web && npm run build`
Expected: Build completes successfully with no errors.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore: remove canvas components and CANVAS_LAYOUT after dashboard migration"
```

---

## Done

After all tasks, the Operations page should:
- Show a KPI bar at the top
- Show a full-width Reception banner with intake/routing/review counts (pulses amber when review > 0)
- Show a responsive grid of department cards (status badge, utilization ring, slot count, queue count)
- Open the reception dialog on banner click
- Open the department dialog on card click
- Poll for fresh data every 5 seconds
