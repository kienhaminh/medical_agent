"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import type { WSEvent, WSEventType } from "@/lib/ws-events";

type Subscriber = (event: WSEvent) => void;

interface UseWebSocketReturn {
  connected: boolean;
  lastEvent: WSEvent | null;
  subscribe: (type: WSEventType | "*", callback: Subscriber) => () => void;
}

const WS_BASE = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8000";
const PING_INTERVAL_MS = 30_000;
const MAX_RECONNECT_DELAY_MS = 30_000;

/**
 * WebSocket connection hook with auto-reconnect and pub/sub.
 *
 * Usage:
 *   const { connected, subscribe } = useWebSocket(token);
 *   useEffect(() => subscribe("order.completed", (e) => ...), [subscribe]);
 */
export function useWebSocket(token: string | null): UseWebSocketReturn {
  const [connected, setConnected] = useState(false);
  const [lastEvent, setLastEvent] = useState<WSEvent | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const subscribersRef = useRef<Map<string, Set<Subscriber>>>(new Map());
  const reconnectAttemptRef = useRef(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mountedRef = useRef(true);

  const dispatch = useCallback((event: WSEvent) => {
    setLastEvent(event);

    // Notify type-specific subscribers
    const typeSubscribers = subscribersRef.current.get(event.type);
    if (typeSubscribers) {
      typeSubscribers.forEach((cb) => cb(event));
    }

    // Notify wildcard subscribers
    const wildcardSubscribers = subscribersRef.current.get("*");
    if (wildcardSubscribers) {
      wildcardSubscribers.forEach((cb) => cb(event));
    }
  }, []);

  const connect = useCallback(() => {
    if (!token || !mountedRef.current) return;

    // Clean up any existing connection — detach handlers first to prevent
    // the old onclose from scheduling a spurious reconnect
    if (wsRef.current) {
      wsRef.current.onclose = null;
      wsRef.current.onerror = null;
      wsRef.current.close();
      wsRef.current = null;
    }

    const ws = new WebSocket(`${WS_BASE}/ws/?token=${token}`);
    wsRef.current = ws;

    ws.onopen = () => {
      if (!mountedRef.current) return;
      setConnected(true);
      reconnectAttemptRef.current = 0;

      // Start ping interval
      if (pingTimerRef.current) clearInterval(pingTimerRef.current);
      pingTimerRef.current = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send("ping");
        }
      }, PING_INTERVAL_MS);
    };

    ws.onmessage = (event) => {
      if (!mountedRef.current) return;
      if (event.data === "pong") return;

      try {
        const parsed = JSON.parse(event.data) as WSEvent;
        dispatch(parsed);
      } catch {
        // Ignore non-JSON messages
      }
    };

    ws.onclose = () => {
      if (!mountedRef.current) return;
      setConnected(false);
      if (pingTimerRef.current) clearInterval(pingTimerRef.current);

      // Exponential backoff reconnect
      const delay = Math.min(
        1000 * Math.pow(2, reconnectAttemptRef.current),
        MAX_RECONNECT_DELAY_MS,
      );
      reconnectAttemptRef.current += 1;
      reconnectTimerRef.current = setTimeout(connect, delay);
    };

    ws.onerror = () => {
      // onclose will fire after onerror, triggering reconnect
    };
  }, [token, dispatch]);

  // Connect on mount / token change
  useEffect(() => {
    mountedRef.current = true;
    connect();

    return () => {
      mountedRef.current = false;
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      if (pingTimerRef.current) clearInterval(pingTimerRef.current);
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [connect]);

  const subscribe = useCallback(
    (type: WSEventType | "*", callback: Subscriber): (() => void) => {
      if (!subscribersRef.current.has(type)) {
        subscribersRef.current.set(type, new Set());
      }
      subscribersRef.current.get(type)!.add(callback);

      // Return unsubscribe function
      return () => {
        subscribersRef.current.get(type)?.delete(callback);
      };
    },
    [],
  );

  return { connected, lastEvent, subscribe };
}
