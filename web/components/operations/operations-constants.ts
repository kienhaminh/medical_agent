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
    text:        "text-muted-foreground",
    cardBg:      "",
    cardBorder:  "border-border",
    cardShadow:  "",
    badgeText:   "text-muted-foreground",
    badgeBg:     "bg-muted",
    badgeBorder: "border-border",
    tileBg:      "bg-muted/50",
    tileBorder:  "border-border",
  },
  OK: {
    text:        "text-foreground",
    cardBg:      "",
    cardBorder:  "border-border",
    cardShadow:  "",
    badgeText:   "text-emerald-600",
    badgeBg:     "bg-emerald-600/10",
    badgeBorder: "border-emerald-600/30",
    tileBg:      "bg-muted/50",
    tileBorder:  "border-border",
  },
  BUSY: {
    text:        "text-foreground",
    cardBg:      "",
    cardBorder:  "border-border",
    cardShadow:  "",
    badgeText:   "text-amber-500",
    badgeBg:     "bg-amber-500/10",
    badgeBorder: "border-amber-500/30",
    tileBg:      "bg-muted/50",
    tileBorder:  "border-border",
  },
  CRITICAL: {
    text:        "text-foreground",
    cardBg:      "",
    cardBorder:  "border-red-500/30",
    cardShadow:  "",
    badgeText:   "text-red-500",
    badgeBg:     "bg-red-500/10",
    badgeBorder: "border-red-500/30",
    tileBg:      "bg-muted/50",
    tileBorder:  "border-border",
  },
} as const;

export type DepartmentStatus = keyof typeof DEPARTMENT_STATUS_STYLES;
