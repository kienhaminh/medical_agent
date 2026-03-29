"use client";

import { useMemo } from "react";
import { User, TestTube, Scan } from "lucide-react";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { LiveBoardFeed } from "@/components/doctor/live-board-feed";
import type { OrderListItem } from "@/lib/api";
import type { WSEvent } from "@/lib/ws-events";

interface PatientOrderSummary {
  patientName: string;
  patientId: number;
  totalOrders: number;
  pendingCount: number;
  myClaimedCount: number;
  labCount: number;
  imagingCount: number;
}

interface NursePatientSidebarProps {
  orders: OrderListItem[];
  currentUserName: string;
  selectedPatientId: number | null;
  onSelectPatient: (patientId: number | null) => void;
  wsEvents: WSEvent[];
}

export function NursePatientSidebar({
  orders,
  currentUserName,
  selectedPatientId,
  onSelectPatient,
  wsEvents,
}: NursePatientSidebarProps) {
  const patients = useMemo(() => {
    const map = new Map<number, PatientOrderSummary>();

    for (const order of orders) {
      const existing = map.get(order.patient_id);
      if (existing) {
        existing.totalOrders++;
        if (order.status === "pending") existing.pendingCount++;
        if (order.fulfilled_by === currentUserName && order.status === "in_progress")
          existing.myClaimedCount++;
        if (order.order_type === "lab") existing.labCount++;
        if (order.order_type === "imaging") existing.imagingCount++;
      } else {
        map.set(order.patient_id, {
          patientName: order.patient_name,
          patientId: order.patient_id,
          totalOrders: 1,
          pendingCount: order.status === "pending" ? 1 : 0,
          myClaimedCount:
            order.fulfilled_by === currentUserName && order.status === "in_progress" ? 1 : 0,
          labCount: order.order_type === "lab" ? 1 : 0,
          imagingCount: order.order_type === "imaging" ? 1 : 0,
        });
      }
    }

    return Array.from(map.values()).sort((a, b) => b.pendingCount - a.pendingCount);
  }, [orders, currentUserName]);

  return (
    <div className="flex flex-col h-full border-r border-border/50 overflow-hidden">
      {/* Header */}
      <div className="shrink-0 px-3 py-3 border-b border-border/50">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Patients ({patients.length})
        </p>
      </div>

      {/* Patient list */}
      <ScrollArea className="flex-1">
        {/* "All" option */}
        <button
          onClick={() => onSelectPatient(null)}
          className={cn(
            "w-full px-3 py-2.5 text-left text-xs font-medium border-b border-border/20 transition-colors",
            selectedPatientId === null
              ? "bg-cyan-500/10 text-cyan-400"
              : "text-muted-foreground hover:bg-muted/30 hover:text-foreground",
          )}
        >
          All Patients
        </button>

        {patients.map((p) => {
          const isSelected = selectedPatientId === p.patientId;
          return (
            <button
              key={p.patientId}
              onClick={() => onSelectPatient(p.patientId)}
              className={cn(
                "w-full px-3 py-2.5 text-left border-b border-border/20 transition-colors",
                isSelected
                  ? "bg-cyan-500/10 border-l-2 border-l-cyan-500"
                  : "hover:bg-muted/30",
              )}
            >
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-md bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center shrink-0">
                  <User className="w-3 h-3 text-cyan-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">{p.patientName}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    {p.pendingCount > 0 && (
                      <span className="text-[10px] text-amber-400">
                        {p.pendingCount} pending
                      </span>
                    )}
                    {p.myClaimedCount > 0 && (
                      <span className="text-[10px] text-cyan-400">
                        {p.myClaimedCount} mine
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {p.labCount > 0 && (
                    <div className="flex items-center gap-0.5">
                      <TestTube className="w-2.5 h-2.5 text-muted-foreground/50" />
                      <span className="text-[10px] text-muted-foreground/50">{p.labCount}</span>
                    </div>
                  )}
                  {p.imagingCount > 0 && (
                    <div className="flex items-center gap-0.5">
                      <Scan className="w-2.5 h-2.5 text-muted-foreground/50" />
                      <span className="text-[10px] text-muted-foreground/50">{p.imagingCount}</span>
                    </div>
                  )}
                </div>
              </div>
            </button>
          );
        })}

        {patients.length === 0 && (
          <p className="text-[10px] text-muted-foreground/50 text-center py-8">
            No patients with orders
          </p>
        )}
      </ScrollArea>

      {/* Live board feed */}
      <div className="shrink-0 border-t border-border/50">
        <LiveBoardFeed events={wsEvents} />
      </div>
    </div>
  );
}
