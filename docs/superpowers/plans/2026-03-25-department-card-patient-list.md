# Department Card Patient List Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show current patients inside each department card with name, chief complaint, wait time, and queue position.

**Architecture:** Pass `departmentVisits` through `DepartmentGrid` to `DepartmentCard`. The card renders a divider + patient rows when visits exist. No new files, no new API calls — data already flows from `useOperationsDashboard`.

**Tech Stack:** Next.js 14, React, TypeScript, Tailwind CSS, monospace dark theme

---

## File Map

| Action | File |
|--------|------|
| **Modify** | `web/components/operations/department-card.tsx` |
| **Modify** | `web/components/operations/department-grid.tsx` |
| **Modify** | `web/app/(dashboard)/operations/page.tsx` |

---

## Task 1: Update `department-card.tsx` to show patient list

**Files:**
- Modify: `web/components/operations/department-card.tsx`

Add `visits: VisitListItem[]` prop. Below the ring row, render a divider and up to 5 patient rows (name, chief complaint, wait time, queue position). Increase the card's apparent size by showing more content.

- [ ] **Step 1: Rewrite `department-card.tsx`**

Replace the entire file with:

```tsx
// web/components/operations/department-card.tsx
"use client";

import type { DepartmentInfo, VisitListItem } from "@/lib/api";
import { DEPARTMENT_STATUS_COLORS, getWaitTimeColor, formatTimeAgo } from "./operations-constants";

interface DepartmentCardProps {
  dept: DepartmentInfo;
  visits: VisitListItem[];
  onClick: () => void;
}

// Circumference of r=20 circle
const CIRCUMFERENCE = 125.66;
const MAX_VISIBLE = 5;

function sortVisits(visits: VisitListItem[]): VisitListItem[] {
  return [...visits].sort((a, b) => {
    const posA = a.queue_position ?? Infinity;
    const posB = b.queue_position ?? Infinity;
    if (posA !== posB) return posA - posB;
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
  });
}

export function DepartmentCard({ dept, visits, onClick }: DepartmentCardProps) {
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

  const sorted = sortVisits(visits);
  const visible = sorted.slice(0, MAX_VISIBLE);
  const overflow = sorted.length - MAX_VISIBLE;

  return (
    <button
      onClick={onClick}
      className={`w-full text-left rounded-xl border px-4 py-3 transition-all hover:brightness-110 focus:outline-none ${isCritical ? "animate-pulse" : ""}`}
      style={{
        background: isClosed ? "rgba(255,255,255,0.02)" : `${statusColor}08`,
        borderColor: isClosed ? "rgba(255,255,255,0.08)" : `${statusColor}40`,
        boxShadow: isCritical ? `0 0 20px ${statusColor}30` : "none",
        opacity: isClosed ? 0.55 : 1,
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
          <circle
            cx="22" cy="22" r="20"
            fill="none"
            stroke={isClosed ? "rgba(255,255,255,0.06)" : `${statusColor}20`}
            strokeWidth="3"
          />
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

      {/* Patient list */}
      {visible.length > 0 && (
        <>
          <hr className="border-none border-t border-white/[0.06] my-2" style={{ borderTopWidth: 1, borderTopStyle: "solid", borderTopColor: "rgba(255,255,255,0.06)" }} />
          <div className="space-y-1.5">
            {visible.map((v) => {
              const waitColor = getWaitTimeColor(v.created_at);
              return (
                <div key={v.visit_id} className="rounded-md px-2 py-1.5" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)" }}>
                  <div className="text-[11px] font-bold font-mono text-[#c9d1d9] truncate">
                    {v.patient_name}
                  </div>
                  {v.chief_complaint && (
                    <div className="text-[10px] font-mono text-[#8b949e] truncate mt-0.5">
                      {v.chief_complaint}
                    </div>
                  )}
                  <div className="flex justify-between mt-1">
                    <span className="text-[10px] font-mono" style={{ color: waitColor }}>
                      {formatTimeAgo(v.created_at)}
                    </span>
                    {v.queue_position != null && (
                      <span className="text-[10px] font-mono text-[#8b949e]">
                        #{v.queue_position}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
            {overflow > 0 && (
              <div className="text-[10px] font-mono text-[#8b949e] text-center pt-1">
                +{overflow} more
              </div>
            )}
          </div>
        </>
      )}
    </button>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd /Users/kien.ha/Code/medical_agent/web && npx tsc --noEmit 2>&1 | grep -v "medical-records\|patient-imaging\|record-grid\|patient-header\|types/agent"`
Expected: No new errors.

- [ ] **Step 3: Commit**

```bash
cd /Users/kien.ha/Code/medical_agent
git add web/components/operations/department-card.tsx
git commit -m "feat: show patient list in department card"
```

---

## Task 2: Update `department-grid.tsx` to pass visits + widen cards

**Files:**
- Modify: `web/components/operations/department-grid.tsx`

Add `departmentVisits` prop, pass correct visits to each card, and widen `minmax` from `180px` to `220px`.

- [ ] **Step 1: Rewrite `department-grid.tsx`**

Replace the entire file with:

```tsx
// web/components/operations/department-grid.tsx
"use client";

import type { DepartmentInfo, VisitListItem } from "@/lib/api";
import { DepartmentCard } from "./department-card";

interface DepartmentGridProps {
  departments: DepartmentInfo[];
  departmentVisits: Record<string, VisitListItem[]>;
  onDeptClick: (deptName: string) => void;
}

export function DepartmentGrid({ departments, departmentVisits, onDeptClick }: DepartmentGridProps) {
  const sorted = [...departments].sort((a, b) => a.label.localeCompare(b.label));

  if (sorted.length === 0) {
    return (
      <div className="flex items-center justify-center py-16 text-[#8b949e] font-mono text-sm">
        No departments configured
      </div>
    );
  }

  return (
    <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))" }}>
      {sorted.map((dept) => (
        <DepartmentCard
          key={dept.name}
          dept={dept}
          visits={departmentVisits[dept.name] ?? []}
          onClick={() => onDeptClick(dept.name)}
        />
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd /Users/kien.ha/Code/medical_agent/web && npx tsc --noEmit 2>&1 | grep -v "medical-records\|patient-imaging\|record-grid\|patient-header\|types/agent"`
Expected: No new errors.

- [ ] **Step 3: Commit**

```bash
cd /Users/kien.ha/Code/medical_agent
git add web/components/operations/department-grid.tsx
git commit -m "feat: pass departmentVisits to DepartmentGrid, widen cards to 220px"
```

---

## Task 3: Update `page.tsx` to pass `departmentVisits` to `DepartmentGrid`

**Files:**
- Modify: `web/app/(dashboard)/operations/page.tsx`

One line change — add `departmentVisits={departmentVisits}` to the `<DepartmentGrid>` usage.

- [ ] **Step 1: Edit `page.tsx`**

Find this block (around line 53):

```tsx
        <DepartmentGrid
          departments={departments}
          onDeptClick={setSelectedDept}
        />
```

Replace with:

```tsx
        <DepartmentGrid
          departments={departments}
          departmentVisits={departmentVisits}
          onDeptClick={setSelectedDept}
        />
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd /Users/kien.ha/Code/medical_agent/web && npx tsc --noEmit 2>&1 | grep -v "medical-records\|patient-imaging\|record-grid\|patient-header\|types/agent"`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
cd /Users/kien.ha/Code/medical_agent
git add "web/app/(dashboard)/operations/page.tsx"
git commit -m "feat: wire departmentVisits into DepartmentGrid on operations page"
```

---

## Done

After all tasks, each department card will show:
- The existing utilization ring and slot count
- A list of up to 5 current patients (name, chief complaint, wait time, queue position)
- `+N more` if more than 5 patients
- Cards are wider (220px min) to accommodate the content
