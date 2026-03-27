// web/components/officer/officer-kpi-bar.tsx
"use client";

import { useEffect, useState } from "react";
import type { ExtendedHospitalStats } from "@/lib/api";
import {
  Activity,
  AlertTriangle,
  Clock,
  LogOut,
  Bed,
  BarChart3,
  Wifi,
} from "lucide-react";

interface OfficerKpiBarProps {
  stats: ExtendedHospitalStats;
  lastUpdated: Date | null;
}

const KPI_ITEMS = [
  {
    key: "active_patients" as const,
    label: "Active Patients",
    icon: Activity,
    color: "#00d9ff",
  },
  {
    key: "occupancy_rate" as const,
    label: "Occupancy",
    icon: BarChart3,
    color: "#a855f7",
    format: (v: number) => `${Math.round(v)}%`,
  },
  {
    key: "available_beds" as const,
    label: "Available Beds",
    icon: Bed,
    color: "#10b981",
    /** Computed from total_beds - occupied_beds */
    derive: (stats: ExtendedHospitalStats) =>
      stats.total_beds - stats.occupied_beds,
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
] as const;

/** Format the time since last data sync. */
function formatSyncAge(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 10) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  return `${Math.floor(seconds / 60)}m ago`;
}

export function OfficerKpiBar({ stats, lastUpdated }: OfficerKpiBarProps) {
  const [, setTick] = useState(0);

  // Re-render every second so the sync age stays current
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="flex items-center gap-3 px-4 py-2 flex-1 min-w-0 overflow-x-auto">
      {KPI_ITEMS.map((item) => {
        const Icon = item.icon;
        const raw =
          "derive" in item
            ? item.derive(stats)
            : stats[item.key as keyof ExtendedHospitalStats];
        const value = typeof raw === "number" ? raw : 0;
        const formatted =
          "format" in item && item.format
            ? item.format(value)
            : String(value);

        return (
          <div
            key={item.key}
            className="flex items-center gap-2 rounded-lg px-3 py-1.5 shrink-0"
            style={{
              background: `${item.color}08`,
              border: `1px solid ${item.color}20`,
            }}
          >
            <Icon size={14} style={{ color: item.color }} />
            <span
              className="text-sm font-bold font-mono"
              style={{ color: item.color }}
            >
              {formatted}
            </span>
            <span className="text-[10px] font-mono text-[#8b949e]">
              {item.label}
            </span>
          </div>
        );
      })}

      {lastUpdated && (
        <div className="ml-auto flex items-center gap-1.5 text-[10px] font-mono text-[#8b949e] shrink-0">
          <Wifi size={10} className="text-emerald-500" />
          {formatSyncAge(lastUpdated)}
        </div>
      )}
    </div>
  );
}
