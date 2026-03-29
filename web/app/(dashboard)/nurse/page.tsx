"use client";

import { useEffect, useState } from "react";
import {
  RefreshCw,
  TestTube,
  Scan,
  CheckCircle2,
  Clock,
  Loader2,
  ClipboardList,
  LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useNurseWorkspace, type TypeFilter } from "./use-nurse-workspace";
import { NursePatientSidebar } from "@/components/nurse/nurse-patient-sidebar";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { ToastNotification } from "@/components/notifications/toast-notification";
import { useAuth } from "@/lib/auth-context";
import { useWebSocket } from "@/hooks/use-websocket";
import { useNotifications } from "@/hooks/use-notifications";
import type { OrderListItem } from "@/lib/api";
import type { WSEvent } from "@/lib/ws-events";

const TYPE_FILTERS: { value: TypeFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "lab", label: "Lab" },
  { value: "imaging", label: "Imaging" },
];

function timeAgo(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function StatusBadge({ status }: { status: OrderListItem["status"] }) {
  const cfg = {
    pending: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    in_progress: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
    completed: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    cancelled: "bg-muted text-muted-foreground border-border/40",
  }[status];
  const label = status.replace("_", " ");
  return (
    <span className={cn("text-[10px] font-medium px-2 py-0.5 rounded-full border capitalize", cfg)}>
      {label}
    </span>
  );
}

interface OrderRowProps {
  order: OrderListItem;
  resultDraft: string;
  onDraftChange: (val: string) => void;
  onClaim: () => void;
  onComplete: () => void;
  currentUserName: string;
}

function OrderRow({ order, resultDraft, onDraftChange, onClaim, onComplete, currentUserName }: OrderRowProps) {
  const Icon = order.order_type === "lab" ? TestTube : Scan;
  const isMyOrder = order.fulfilled_by === currentUserName;

  return (
    <div className="group rounded-xl border border-border/40 bg-card/30 p-4 space-y-3 hover:border-border/60 transition-colors">
      {/* Top row */}
      <div className="flex items-start gap-3">
        <div className="mt-0.5 w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center shrink-0">
          <Icon className="w-4 h-4 text-cyan-400" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold truncate">{order.order_name}</p>
            <StatusBadge status={order.status} />
          </div>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            <span className="text-xs font-medium text-cyan-400">{order.patient_name}</span>
            <span className="text-[10px] text-muted-foreground/50">&middot;</span>
            <span className="text-[10px] text-muted-foreground/60 font-mono">{order.visit_ref}</span>
            <span className="text-[10px] text-muted-foreground/50">&middot;</span>
            <Clock className="w-2.5 h-2.5 text-muted-foreground/40" />
            <span className="text-[10px] text-muted-foreground/50">{timeAgo(order.created_at)}</span>
          </div>
          {order.ordered_by && (
            <p className="text-[10px] text-muted-foreground/40 mt-0.5">
              Ordered by {order.ordered_by}
            </p>
          )}
          {order.notes && (
            <p className="text-[11px] text-muted-foreground/60 mt-1 italic">&ldquo;{order.notes}&rdquo;</p>
          )}
        </div>

        {order.status === "pending" && (
          <button
            onClick={onClaim}
            className="shrink-0 text-xs font-semibold px-3 py-1.5 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/20 transition-colors"
          >
            Claim
          </button>
        )}
      </div>

      {/* In-progress: result input or claimer info */}
      {order.status === "in_progress" && (
        <div className="pl-11 space-y-2">
          {isMyOrder ? (
            <>
              <textarea
                value={resultDraft}
                onChange={(e) => onDraftChange(e.target.value)}
                placeholder="Enter result notes (e.g. WBC 11.2, Hgb 13.4...)"
                rows={2}
                className="w-full rounded-lg border border-border/50 bg-background/40 px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground/40 resize-none focus:outline-none focus:border-cyan-500/40 transition-colors"
              />
              <button
                onClick={onComplete}
                className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20 transition-colors"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                Mark Complete
              </button>
            </>
          ) : (
            <p className="text-[11px] text-muted-foreground/50 italic">
              In progress by {order.fulfilled_by}
            </p>
          )}
        </div>
      )}

      {/* Completed: show results */}
      {order.status === "completed" && order.result_notes && (
        <div className="pl-11">
          <p className="text-[11px] text-emerald-400/80 bg-emerald-500/5 border border-emerald-500/15 rounded-lg px-3 py-2">
            {order.result_notes}
          </p>
          {order.fulfilled_by && (
            <p className="text-[10px] text-muted-foreground/40 mt-1">by {order.fulfilled_by}</p>
          )}
        </div>
      )}
    </div>
  );
}

interface OrderGroupProps {
  title: string;
  count: number;
  orders: OrderListItem[];
  resultDrafts: Record<number, string>;
  onDraftChange: (orderId: number, val: string) => void;
  onClaim: (orderId: number) => void;
  onComplete: (orderId: number) => void;
  currentUserName: string;
  accentColor?: string;
  defaultOpen?: boolean;
}

function OrderGroup({
  title,
  count,
  orders,
  resultDrafts,
  onDraftChange,
  onClaim,
  onComplete,
  currentUserName,
  accentColor = "text-muted-foreground",
  defaultOpen = true,
}: OrderGroupProps) {
  if (count === 0) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 px-1">
        <h3 className={cn("text-xs font-semibold uppercase tracking-wider", accentColor)}>
          {title}
        </h3>
        <span className="text-[10px] text-muted-foreground/50 bg-muted/30 px-1.5 py-0.5 rounded-full">
          {count}
        </span>
      </div>
      <div className="space-y-2">
        {orders.map((order) => (
          <OrderRow
            key={order.id}
            order={order}
            resultDraft={resultDrafts[order.id] ?? ""}
            onDraftChange={(val) => onDraftChange(order.id, val)}
            onClaim={() => onClaim(order.id)}
            onComplete={() => onComplete(order.id)}
            currentUserName={currentUserName}
          />
        ))}
      </div>
    </div>
  );
}

export default function NursePage() {
  const { token, logout } = useAuth();
  const [wsEvents, setWsEvents] = useState<WSEvent[]>([]);

  // WebSocket connection
  const { subscribe } = useWebSocket(token);
  const { bellItems, toasts, unreadCount, dismissToast, markAllRead, clearBellItem } =
    useNotifications(subscribe);

  // Collect WS events
  useEffect(() => {
    return subscribe("*", (event) => {
      setWsEvents((prev) => [...prev.slice(-100), event]);
    });
  }, [subscribe]);

  const workspace = useNurseWorkspace(wsEvents);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="shrink-0 border-b border-border/50 px-5 h-14 flex items-center gap-4">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-md bg-cyan-500/15 border border-cyan-500/25 flex items-center justify-center">
            <ClipboardList className="w-3.5 h-3.5 text-cyan-400" />
          </div>
          <div className="leading-tight">
            <h1 className="text-sm font-semibold leading-none">Order Fulfillment</h1>
            <p className="text-[10px] text-muted-foreground/50 mt-0.5 uppercase tracking-widest">
              Nurse Workstation
            </p>
          </div>
        </div>

        {/* Type filter */}
        <div className="flex items-center gap-1 rounded-lg border border-border/40 bg-muted/30 p-0.5">
          {TYPE_FILTERS.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => workspace.setTypeFilter(value)}
              className={cn(
                "px-3 py-1 text-xs font-medium rounded-md transition-colors",
                workspace.typeFilter === value
                  ? "bg-cyan-500/15 text-cyan-400 border border-cyan-500/25"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex-1" />

        {!workspace.loading && (
          <span className="text-xs text-muted-foreground/60">
            {workspace.orders.length} order{workspace.orders.length !== 1 ? "s" : ""}
          </span>
        )}

        <button
          onClick={workspace.fetchOrders}
          disabled={workspace.loading}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground disabled:opacity-40 transition-colors"
        >
          <RefreshCw className={cn("w-3.5 h-3.5", workspace.loading && "animate-spin")} />
          Refresh
        </button>

        <NotificationBell
          items={bellItems}
          unreadCount={unreadCount}
          onMarkRead={markAllRead}
          onClear={clearBellItem}
        />

        <button
          onClick={logout}
          className="flex items-center gap-1.5 text-xs text-muted-foreground/60 hover:text-foreground transition-colors"
          title="Sign out"
        >
          <LogOut className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* 2-Zone Layout */}
      <div className="flex flex-1 overflow-hidden min-h-0">
        {/* Zone A: Patient Sidebar */}
        <div className="w-60 shrink-0">
          <NursePatientSidebar
            orders={workspace.orders}
            currentUserName={workspace.currentUserName}
            selectedPatientId={workspace.selectedPatientId}
            onSelectPatient={workspace.setSelectedPatientId}
            wsEvents={wsEvents}
          />
        </div>

        {/* Zone B: Grouped Orders */}
        <ScrollArea className="flex-1">
        <div className="p-5 space-y-6">
          {workspace.loading && workspace.orders.length === 0 ? (
            <div className="flex items-center justify-center py-20 gap-2 text-muted-foreground/50">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-sm">Loading orders...</span>
            </div>
          ) : workspace.orders.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
              <div className="w-12 h-12 rounded-2xl bg-muted/40 border border-border/40 flex items-center justify-center">
                <ClipboardList className="w-5 h-5 text-muted-foreground/40" />
              </div>
              <p className="text-sm text-muted-foreground/60">No orders found</p>
            </div>
          ) : (
            <>
              {/* My Claimed Orders */}
              <OrderGroup
                title="My Orders"
                count={workspace.claimedByMe.length}
                orders={workspace.claimedByMe}
                resultDrafts={workspace.resultDrafts}
                onDraftChange={workspace.setResultDraft}
                onClaim={workspace.handleClaim}
                onComplete={workspace.handleComplete}
                currentUserName={workspace.currentUserName}
                accentColor="text-cyan-400"
              />

              {/* Pending Orders */}
              <OrderGroup
                title="Pending"
                count={workspace.pending.length}
                orders={workspace.pending}
                resultDrafts={workspace.resultDrafts}
                onDraftChange={workspace.setResultDraft}
                onClaim={workspace.handleClaim}
                onComplete={workspace.handleComplete}
                currentUserName={workspace.currentUserName}
                accentColor="text-amber-400"
              />

              {/* In Progress by Others */}
              <OrderGroup
                title="In Progress (Others)"
                count={workspace.inProgressByOthers.length}
                orders={workspace.inProgressByOthers}
                resultDrafts={workspace.resultDrafts}
                onDraftChange={workspace.setResultDraft}
                onClaim={workspace.handleClaim}
                onComplete={workspace.handleComplete}
                currentUserName={workspace.currentUserName}
                accentColor="text-muted-foreground"
              />

              {/* Completed Today */}
              <OrderGroup
                title="Completed Today"
                count={workspace.completedToday.length}
                orders={workspace.completedToday}
                resultDrafts={workspace.resultDrafts}
                onDraftChange={workspace.setResultDraft}
                onClaim={workspace.handleClaim}
                onComplete={workspace.handleComplete}
                currentUserName={workspace.currentUserName}
                accentColor="text-emerald-400"
              />

              {/* Empty state when all groups are empty (filtered by patient) */}
              {workspace.claimedByMe.length === 0 &&
                workspace.pending.length === 0 &&
                workspace.inProgressByOthers.length === 0 &&
                workspace.completedToday.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
                    <ClipboardList className="w-5 h-5 text-muted-foreground/40" />
                    <p className="text-sm text-muted-foreground/60">
                      No orders for this patient
                    </p>
                  </div>
                )}
            </>
          )}
        </div>
        </ScrollArea>
      </div>

      {/* Toast notifications */}
      <ToastNotification toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
