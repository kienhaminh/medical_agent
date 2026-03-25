// web/components/operations/operations-constants.ts

/** Status colors, labels, and time helpers for the operations dashboard. */

export const RECEPTION_STATUSES = ["intake", "triaged", "auto_routed", "pending_review", "routed"] as const;
export const DEPARTMENT_STATUS = "in_department" as const;

export const WAIT_TIME_COLORS = {
  short: "#00d9ff",   // < 10 minutes — cyan
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

export const DEPARTMENT_STATUS_COLORS = {
  IDLE: "#6b7280",
  OK: "#10b981",
  BUSY: "#f59e0b",
  CRITICAL: "#ef4444",
} as const;
