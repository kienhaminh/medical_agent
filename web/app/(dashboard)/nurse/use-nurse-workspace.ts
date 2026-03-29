"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { listAllOrders, claimOrder, completeOrder, type OrderListItem } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import type { WSEvent } from "@/lib/ws-events";

export type TypeFilter = "all" | "lab" | "imaging";

export function useNurseWorkspace(wsEvents: WSEvent[]) {
  const { user } = useAuth();
  const [orders, setOrders] = useState<OrderListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [selectedPatientId, setSelectedPatientId] = useState<number | null>(null);
  /** orderId -> result text being typed before submission */
  const [resultDrafts, setResultDrafts] = useState<Record<number, string>>({});

  const currentUserName = user?.name ?? "";

  // Fetch all orders (no status filter — we group client-side)
  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const params: { order_type?: string } = {};
      if (typeFilter !== "all") params.order_type = typeFilter;
      const data = await listAllOrders(params);
      setOrders(data);
    } catch {
      // silently keep stale data
    } finally {
      setLoading(false);
    }
  }, [typeFilter]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  // React to WebSocket events for real-time updates
  useEffect(() => {
    if (wsEvents.length === 0) return;
    const latest = wsEvents[wsEvents.length - 1];

    if (latest.type === "order.created") {
      // Add new order to the list
      fetchOrders();
    } else if (latest.type === "order.claimed") {
      const p = latest.payload;
      setOrders((prev) =>
        prev.map((o) =>
          o.id === p.order_id
            ? { ...o, status: "in_progress" as const, fulfilled_by: p.fulfilled_by as string }
            : o,
        ),
      );
    } else if (latest.type === "order.completed") {
      const p = latest.payload;
      setOrders((prev) =>
        prev.map((o) =>
          o.id === p.order_id
            ? {
                ...o,
                status: "completed" as const,
                fulfilled_by: p.fulfilled_by as string,
                result_notes: p.result_notes as string | undefined,
              }
            : o,
        ),
      );
    }
  }, [wsEvents, fetchOrders]);

  // Grouped orders
  const filteredOrders = useMemo(() => {
    let filtered = orders;
    if (selectedPatientId !== null) {
      filtered = filtered.filter((o) => o.patient_id === selectedPatientId);
    }
    return filtered;
  }, [orders, selectedPatientId]);

  const claimedByMe = useMemo(
    () => filteredOrders.filter((o) => o.status === "in_progress" && o.fulfilled_by === currentUserName),
    [filteredOrders, currentUserName],
  );

  const pending = useMemo(
    () => filteredOrders.filter((o) => o.status === "pending"),
    [filteredOrders],
  );

  const inProgressByOthers = useMemo(
    () =>
      filteredOrders.filter(
        (o) => o.status === "in_progress" && o.fulfilled_by !== currentUserName,
      ),
    [filteredOrders, currentUserName],
  );

  const completedToday = useMemo(() => {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    return filteredOrders.filter(
      (o) => o.status === "completed" && new Date(o.updated_at) >= todayStart,
    );
  }, [filteredOrders]);

  const handleClaim = useCallback(
    async (orderId: number) => {
      if (!currentUserName) return;
      try {
        const updated = await claimOrder(orderId, currentUserName);
        setOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, ...updated } : o)));
      } catch {
        fetchOrders();
      }
    },
    [currentUserName, fetchOrders],
  );

  const handleComplete = useCallback(
    async (orderId: number) => {
      if (!currentUserName) return;
      const result_notes = resultDrafts[orderId] ?? "";
      try {
        const updated = await completeOrder(orderId, {
          result_notes: result_notes || undefined,
          fulfilled_by: currentUserName,
        });
        setOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, ...updated } : o)));
        setResultDrafts((prev) => {
          const next = { ...prev };
          delete next[orderId];
          return next;
        });
      } catch {
        fetchOrders();
      }
    },
    [currentUserName, resultDrafts, fetchOrders],
  );

  const setResultDraft = useCallback((orderId: number, value: string) => {
    setResultDrafts((prev) => ({ ...prev, [orderId]: value }));
  }, []);

  return {
    orders,
    loading,
    typeFilter,
    setTypeFilter,
    selectedPatientId,
    setSelectedPatientId,
    fetchOrders,
    handleClaim,
    handleComplete,
    resultDrafts,
    setResultDraft,
    currentUserName,
    // Grouped
    claimedByMe,
    pending,
    inProgressByOthers,
    completedToday,
  };
}
