// web/components/operations/operations-constants.ts

/** Status colors, labels, and time helpers for the operations dashboard. */

export const RECEPTION_STATUSES = ["intake", "triaged", "auto_routed", "pending_review", "routed"] as const;
export const DEPARTMENT_STATUS = "in_department" as const;

export const WAIT_TIME_COLORS = {
  short: "#059669",   // < 10 minutes — sage/emerald
  medium: "#f59e0b",  // 10-30 minutes — amber
  long: "#ef4444",    // > 30 minutes — red
} as const;

export function getWaitTimeColor(createdAt: string): string {
  const minutes = (Date.now() - new Date(createdAt).getTime()) / 60000;
  if (minutes < 10) return WAIT_TIME_COLORS.short;
  if (minutes < 30) return WAIT_TIME_COLORS.medium;
  return WAIT_TIME_COLORS.long;
}

export function formatTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

/** Resolve a department DB name (or label) to its display label. */
export function deptLabel(name: string, departments: { name: string; label: string }[]): string {
  return departments.find((d) => d.name === name || d.label === name)?.label ?? name;
}

export const DEPARTMENT_STATUS_COLORS = {
  IDLE: "#6b7280",
  OK: "#059669",
  BUSY: "#f59e0b",
  CRITICAL: "#ef4444",
} as const;

export const DEPARTMENT_STATUS_STYLES = {
  IDLE: {
    text:        "text-gray-500",
    cardBg:      "bg-gray-500/[0.08]",
    cardBorder:  "border-gray-500/40",
    cardShadow:  "",
    badgeBg:     "bg-gray-500/20",
    badgeBorder: "border-gray-500/30",
    tileBg:      "bg-gray-500/10",
    tileBorder:  "border-gray-500/40",
  },
  OK: {
    text:        "text-emerald-600",
    cardBg:      "bg-emerald-600/[0.08]",
    cardBorder:  "border-emerald-600/40",
    cardShadow:  "",
    badgeBg:     "bg-emerald-600/20",
    badgeBorder: "border-emerald-600/30",
    tileBg:      "bg-emerald-600/10",
    tileBorder:  "border-emerald-600/40",
  },
  BUSY: {
    text:        "text-amber-500",
    cardBg:      "bg-amber-500/[0.08]",
    cardBorder:  "border-amber-500/40",
    cardShadow:  "",
    badgeBg:     "bg-amber-500/20",
    badgeBorder: "border-amber-500/30",
    tileBg:      "bg-amber-500/10",
    tileBorder:  "border-amber-500/40",
  },
  CRITICAL: {
    text:        "text-red-500",
    cardBg:      "bg-red-500/[0.08]",
    cardBorder:  "border-red-500/40",
    cardShadow:  "shadow-[0_0_20px_rgba(239,68,68,0.3)]",
    badgeBg:     "bg-red-500/20",
    badgeBorder: "border-red-500/30",
    tileBg:      "bg-red-500/10",
    tileBorder:  "border-red-500/40",
  },
} as const;

export type DepartmentStatus = keyof typeof DEPARTMENT_STATUS_STYLES;
