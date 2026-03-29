"use client";

import { useState } from "react";
import { ClipboardList, Plus, TestTube, Scan, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Order } from "@/lib/api";

interface OrdersPanelProps {
  orders: Order[];
  onCreateOrder: (type: "lab" | "imaging", name: string, notes?: string) => Promise<void>;
  onRefresh?: () => void;
  disabled?: boolean;
  loading?: boolean;
}

const STATUS_STYLE: Record<string, string> = {
  pending: "text-amber-500 bg-amber-500/10 border-amber-500/20",
  in_progress: "text-cyan-500 bg-cyan-500/10 border-cyan-500/20",
  completed: "text-emerald-500 bg-emerald-500/10 border-emerald-500/20",
  cancelled: "text-muted-foreground bg-muted/40 border-border/40",
};

const QUICK_ORDERS = {
  lab: ["CBC", "BMP", "Troponin", "D-Dimer", "ABG", "Lipid Panel", "HbA1c"],
  imaging: ["Chest X-Ray", "CT Head", "CT Chest", "CT Abdomen/Pelvis", "ECG", "Echo"],
};

export function OrdersPanel({ orders, onCreateOrder, onRefresh, disabled, loading }: OrdersPanelProps) {
  const [orderType, setOrderType] = useState<"lab" | "imaging">("lab");
  const [orderName, setOrderName] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!orderName.trim()) return;
    setSubmitting(true);
    try {
      await onCreateOrder(orderType, orderName.trim(), notes.trim() || undefined);
      setOrderName("");
      setNotes("");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="overflow-hidden">
      {/* New order form */}
      <div className="p-3 border-b border-border/50 space-y-2">
        <div className="flex gap-1.5">
          {(["lab", "imaging"] as const).map((t) => (
            <button
              key={t}
              onClick={() => { setOrderType(t); setOrderName(""); }}
              className={cn(
                "flex items-center gap-1 text-xs px-2.5 py-1 rounded-md border font-medium transition-colors",
                orderType === t
                  ? "bg-cyan-500/15 text-cyan-400 border-cyan-500/30"
                  : "border-border/50 text-muted-foreground hover:border-foreground/40"
              )}
            >
              {t === "lab" ? <TestTube className="h-3 w-3" /> : <Scan className="h-3 w-3" />}
              {t === "lab" ? "Lab" : "Imaging"}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap gap-1">
          {QUICK_ORDERS[orderType].map((name) => (
            <button
              key={name}
              onClick={() => setOrderName(name)}
              className={cn(
                "text-xs px-2 py-0.5 rounded border transition-colors",
                orderName === name
                  ? "bg-cyan-500/10 border-cyan-500/30 text-cyan-400"
                  : "border-border/50 text-muted-foreground hover:border-foreground/40"
              )}
            >
              {name}
            </button>
          ))}
        </div>

        <input
          className="w-full text-xs px-2.5 py-1.5 rounded-md border border-border/50 bg-background/40 placeholder:text-muted-foreground/40 focus:outline-none focus:border-cyan-500/40 transition-colors"
          placeholder="Order name (or type custom)"
          value={orderName}
          onChange={(e) => setOrderName(e.target.value)}
          disabled={disabled || submitting}
        />

        <button
          onClick={handleSubmit}
          disabled={!orderName.trim() || disabled || submitting}
          className="w-full flex items-center justify-center gap-1.5 text-xs py-1.5 rounded-md bg-cyan-600/80 text-white hover:bg-cyan-600 disabled:opacity-40 transition-colors"
        >
          <Plus className="h-3.5 w-3.5" />
          {submitting ? "Placing…" : "Place Order"}
        </button>
      </div>

      {/* Orders list */}
      {orders.length === 0 ? (
        <p className="text-xs text-muted-foreground/50 text-center py-4">No orders yet</p>
      ) : (
        <div className="divide-y divide-border/30">
          {orders.map((o) => (
            <div key={o.id} className="px-3 py-2.5 space-y-1">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 min-w-0">
                  {o.order_type === "lab"
                    ? <TestTube className="h-3 w-3 text-muted-foreground/50 shrink-0" />
                    : <Scan className="h-3 w-3 text-muted-foreground/50 shrink-0" />}
                  <span className="text-xs font-medium truncate">{o.order_name}</span>
                </div>
                <span className={cn(
                  "text-[10px] px-2 py-0.5 rounded-full border font-medium shrink-0 capitalize",
                  STATUS_STYLE[o.status]
                )}>
                  {o.status.replace("_", " ")}
                </span>
              </div>

              {o.notes && (
                <p className="text-[10px] text-muted-foreground/50 truncate pl-4">{o.notes}</p>
              )}

              {/* Result notes — shown when completed */}
              {o.status === "completed" && o.result_notes && (
                <div className="pl-4 mt-1">
                  <p className="text-[10px] text-emerald-400/80 bg-emerald-500/5 border border-emerald-500/15 rounded px-2 py-1">
                    {o.result_notes}
                  </p>
                  {o.fulfilled_by && (
                    <p className="text-[9px] text-muted-foreground/40 mt-0.5">by {o.fulfilled_by}</p>
                  )}
                </div>
              )}

              {/* In-progress: show who claimed it */}
              {o.status === "in_progress" && o.fulfilled_by && (
                <p className="text-[10px] text-cyan-400/60 pl-4">claimed by {o.fulfilled_by}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
