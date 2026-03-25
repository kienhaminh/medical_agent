// web/components/operations/operations-constants.ts

/** Status colors and labels for the operations canvas. */

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

/** Default canvas layout positions. */
export const CANVAS_LAYOUT = {
  RECEPTION_Y: 50,
  DEPARTMENT_START_Y: 250,
  DEPARTMENT_ROW_GAP: 220,
  DEPARTMENT_COL_GAP: 200,
  DEPARTMENTS_PER_ROW: 7,
  DISCHARGE_Y: 750,
  CENTER_X: 700,
} as const;
