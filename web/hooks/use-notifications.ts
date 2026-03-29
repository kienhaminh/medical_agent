"use client";

import { useEffect, useCallback, useState } from "react";
import type { WSEvent, WSEventType, NotificationItem, ToastItem } from "@/lib/ws-events";
import { NOTIFICATION_ROUTING, eventTitle, eventDescription } from "@/lib/ws-events";

const MAX_BELL_ITEMS = 50;
const TOAST_AUTO_DISMISS_MS = 10_000;

interface UseNotificationsReturn {
  bellItems: NotificationItem[];
  toasts: ToastItem[];
  unreadCount: number;
  dismissToast: (id: string) => void;
  markAllRead: () => void;
  clearBellItem: (id: string) => void;
}

/**
 * Notification state management driven by WebSocket events.
 *
 * Usage:
 *   const { bellItems, toasts, unreadCount, dismissToast, markAllRead } = useNotifications(subscribe);
 */
export function useNotifications(
  subscribe: (type: WSEventType | "*", cb: (e: WSEvent) => void) => () => void,
): UseNotificationsReturn {
  const [bellItems, setBellItems] = useState<NotificationItem[]>([]);
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const unreadCount = bellItems.filter((item) => !item.read).length;

  // Handle incoming events
  const handleEvent = useCallback((event: WSEvent) => {
    const routing = NOTIFICATION_ROUTING[event.type];
    if (!routing) return;

    const id = `${event.type}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const now = new Date();

    // Add to bell
    if (routing.bell) {
      const item: NotificationItem = {
        id,
        type: event.type,
        title: eventTitle(event.type, event.payload),
        description: eventDescription(event.type, event.payload),
        timestamp: now,
        read: false,
        payload: event.payload,
      };

      setBellItems((prev) => [item, ...prev].slice(0, MAX_BELL_ITEMS));
    }

    // Add toast for critical/urgent events
    if (routing.toast || event.severity === "critical") {
      const toast: ToastItem = {
        id,
        type: event.type,
        title: eventTitle(event.type, event.payload),
        description: eventDescription(event.type, event.payload),
        severity: event.severity,
        timestamp: now,
      };

      setToasts((prev) => [...prev, toast]);

      // Auto-dismiss after timeout
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, TOAST_AUTO_DISMISS_MS);
    }
  }, []);

  // Subscribe to all events
  useEffect(() => {
    return subscribe("*", handleEvent);
  }, [subscribe, handleEvent]);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const markAllRead = useCallback(() => {
    setBellItems((prev) => prev.map((item) => ({ ...item, read: true })));
  }, []);

  const clearBellItem = useCallback((id: string) => {
    setBellItems((prev) => prev.filter((item) => item.id !== id));
  }, []);

  return { bellItems, toasts, unreadCount, dismissToast, markAllRead, clearBellItem };
}
