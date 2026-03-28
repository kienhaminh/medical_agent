"use client";

import { useState } from "react";
import { ClipboardList, Plus, TestTube, Scan } from "lucide-react";
import type { Order } from "@/lib/api";

interface OrdersPanelProps {
  orders: Order[];
  onCreateOrder: (type: "lab" | "imaging", name: string, notes?: string) => Promise<void>;
  disabled?: boolean;
  loading?: boolean;
}

const STATUS_STYLE: Record<string, string> = {
  pending: "text-amber-600 bg-amber-50",
  in_progress: "text-blue-600 bg-blue-50",
  completed: "text-green-600 bg-green-50",
  cancelled: "text-slate-500 bg-slate-100",
};

const QUICK_ORDERS = {
  lab: ["CBC", "BMP", "Troponin", "D-Dimer", "ABG", "Lipid Panel", "HbA1c"],
  imaging: ["Chest X-Ray", "CT Head", "CT Chest", "CT Abdomen/Pelvis", "ECG", "Echo"],
};

export function OrdersPanel({ orders, onCreateOrder, disabled, loading }: OrdersPanelProps) {
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
    <div className="border border-border rounded-lg overflow-hidden">
      <div className="flex items-center gap-2 p-3 bg-muted/30 border-b border-border">
        <ClipboardList className="h-4 w-4 text-teal-600" />
        <span className="text-sm font-medium">Orders</span>
        {orders.length > 0 && (
          <span className="ml-auto text-xs text-muted-foreground">{orders.length} order{orders.length !== 1 ? "s" : ""}</span>
        )}
      </div>

      {/* New order form */}
      <div className="p-3 border-b border-border space-y-2">
        <div className="flex gap-1.5">
          {(["lab", "imaging"] as const).map((t) => (
            <button
              key={t}
              onClick={() => { setOrderType(t); setOrderName(""); }}
              className={`flex items-center gap-1 text-xs px-2.5 py-1 rounded-md border font-medium transition-colors ${
                orderType === t
                  ? "bg-teal-600 text-white border-teal-600"
                  : "border-border text-muted-foreground hover:border-foreground"
              }`}
            >
              {t === "lab" ? <TestTube className="h-3 w-3" /> : <Scan className="h-3 w-3" />}
              {t === "lab" ? "Lab" : "Imaging"}
            </button>
          ))}
        </div>

        {/* Quick select */}
        <div className="flex flex-wrap gap-1">
          {QUICK_ORDERS[orderType].map((name) => (
            <button
              key={name}
              onClick={() => setOrderName(name)}
              className={`text-xs px-2 py-0.5 rounded border transition-colors ${
                orderName === name
                  ? "bg-teal-50 border-teal-300 text-teal-700"
                  : "border-border text-muted-foreground hover:border-foreground"
              }`}
            >
              {name}
            </button>
          ))}
        </div>

        <input
          className="w-full text-xs px-2.5 py-1.5 rounded-md border border-border bg-background placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          placeholder="Order name (or type custom)"
          value={orderName}
          onChange={(e) => setOrderName(e.target.value)}
          disabled={disabled || submitting}
        />

        <button
          onClick={handleSubmit}
          disabled={!orderName.trim() || disabled || submitting}
          className="w-full flex items-center justify-center gap-1.5 text-xs py-1.5 rounded-md bg-teal-600 text-white hover:bg-teal-700 disabled:opacity-50 transition-colors"
        >
          <Plus className="h-3.5 w-3.5" />
          {submitting ? "Placing..." : "Place Order"}
        </button>
      </div>

      {/* Orders list */}
      {orders.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-4">No orders yet</p>
      ) : (
        <div className="divide-y divide-border">
          {orders.map((o) => (
            <div key={o.id} className="flex items-center justify-between px-3 py-2">
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  {o.order_type === "lab" ? <TestTube className="h-3 w-3 text-muted-foreground shrink-0" /> : <Scan className="h-3 w-3 text-muted-foreground shrink-0" />}
                  <span className="text-xs font-medium truncate">{o.order_name}</span>
                </div>
                {o.notes && <p className="text-xs text-muted-foreground truncate pl-4">{o.notes}</p>}
              </div>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ml-2 ${STATUS_STYLE[o.status]}`}>
                {o.status}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
