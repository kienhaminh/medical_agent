// web/components/operations/kpi-bar.tsx
"use client";

import type { HospitalStats } from "@/lib/api";
import { Activity, AlertTriangle, Clock, LogOut } from "lucide-react";

interface KpiBarProps {
  stats: HospitalStats;
}

const KPI_ITEMS = [
  {
    key: "active_patients" as const,
    label: "Active Patients",
    icon: Activity,
    color: "#00d9ff",
  },
  {
    key: "departments_at_capacity" as const,
    label: "At Capacity",
    icon: AlertTriangle,
    color: "#ef4444",
  },
  {
    key: "avg_wait_minutes" as const,
    label: "Avg Wait",
    icon: Clock,
    color: "#f59e0b",
    format: (v: number) => `${v.toFixed(0)}m`,
  },
  {
    key: "discharged_today" as const,
    label: "Discharged Today",
    icon: LogOut,
    color: "#10b981",
  },
];

export function KpiBar({ stats }: KpiBarProps) {
  return (
    <div className="flex items-center gap-3 px-4 py-2 flex-1 min-w-0">
      {KPI_ITEMS.map((item) => {
        const Icon = item.icon;
        const value = stats[item.key];
        const formatted = item.format ? item.format(value) : String(value);

        return (
          <div
            key={item.key}
            className="flex items-center gap-2 rounded-lg px-3 py-1.5"
            style={{ background: `${item.color}08`, border: `1px solid ${item.color}20` }}
          >
            <Icon size={14} style={{ color: item.color }} />
            <span className="text-sm font-bold font-mono" style={{ color: item.color }}>
              {formatted}
            </span>
            <span className="text-[10px] font-mono text-[#8b949e]">{item.label}</span>
          </div>
        );
      })}
    </div>
  );
}
