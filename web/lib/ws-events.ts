/**
 * WebSocket event type definitions matching the backend WSEvent model.
 * Used by use-websocket.ts and use-notifications.ts hooks.
 */

// All event types emitted by the backend
export type WSEventType =
  | "order.created"
  | "order.claimed"
  | "order.completed"
  | "visit.created"
  | "visit.routed"
  | "visit.checked_in"
  | "visit.completed"
  | "visit.transferred"
  | "visit.notes_updated"
  | "queue.updated"
  | "ai.insight"
  | "lab.critical";

export type EventSeverity = "info" | "warning" | "critical";

// A single event received over WebSocket
export interface WSEvent {
  type: WSEventType;
  payload: Record<string, unknown>;
  target_type: "room" | "role" | "user";
  target_id: string;
  severity: EventSeverity;
}

// Notification item for the bell dropdown
export interface NotificationItem {
  id: string;
  type: WSEventType;
  title: string;
  description: string;
  timestamp: Date;
  read: boolean;
  payload: Record<string, unknown>;
}

// Toast notification for urgent alerts
export interface ToastItem {
  id: string;
  type: WSEventType;
  title: string;
  description: string;
  severity: EventSeverity;
  timestamp: Date;
}

// Which UI layers each event type triggers
type NotificationLayers = { bell: boolean; inline: boolean; toast: boolean };

export const NOTIFICATION_ROUTING: Record<WSEventType, NotificationLayers> = {
  "order.created":      { bell: true,  inline: true,  toast: false },
  "order.claimed":      { bell: true,  inline: true,  toast: false },
  "order.completed":    { bell: true,  inline: true,  toast: false },
  "visit.created":      { bell: true,  inline: true,  toast: false },
  "visit.routed":       { bell: true,  inline: true,  toast: false },
  "visit.checked_in":   { bell: true,  inline: true,  toast: false },
  "visit.completed":    { bell: true,  inline: true,  toast: false },
  "visit.transferred":  { bell: true,  inline: true,  toast: false },
  "visit.notes_updated":{ bell: false, inline: true,  toast: false },
  "queue.updated":      { bell: false, inline: true,  toast: false },
  "ai.insight":         { bell: false, inline: false, toast: false },
  "lab.critical":       { bell: true,  inline: true,  toast: true  },
};

// Human-readable titles for notification display
export function eventTitle(type: WSEventType, payload: Record<string, unknown>): string {
  switch (type) {
    case "order.created":
      return `New order: ${payload.order_name}`;
    case "order.claimed":
      return `Order claimed: ${payload.order_name}`;
    case "order.completed":
      return `Order complete: ${payload.order_name}`;
    case "visit.checked_in":
      return "New patient checked in";
    case "visit.completed":
      return "Patient discharged";
    case "visit.transferred":
      return `Patient transferred to ${payload.new_department}`;
    case "lab.critical":
      return `Critical lab result: ${payload.order_name}`;
    default:
      return type;
  }
}

export function eventDescription(type: WSEventType, payload: Record<string, unknown>): string {
  switch (type) {
    case "order.created":
      return `${payload.ordered_by || "Doctor"} ordered ${payload.order_name} for patient`;
    case "order.claimed":
      return `${payload.fulfilled_by} is working on ${payload.order_name} for ${payload.patient_name}`;
    case "order.completed":
      return `${payload.fulfilled_by} completed ${payload.order_name} for ${payload.patient_name}`;
    case "visit.checked_in":
      return `Patient checked into ${payload.current_department}`;
    case "visit.completed":
      return "Visit completed";
    case "visit.transferred":
      return `Transferred from ${payload.old_department} to ${payload.new_department}`;
    case "lab.critical":
      return `${payload.result_notes}`;
    default:
      return "";
  }
}
