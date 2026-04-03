"use client";

import { useEffect, useState, useCallback } from "react";
import { User, FlaskConical, Activity } from "lucide-react";
import { StepItem, type Step } from "./step-item";

interface Order {
  order_name: string;
  order_type: string;
  status: string;
}

interface TrackingData {
  visit_id: string;
  patient_name: string;
  status: string;
  urgency_level: string | null;
  chief_complaint: string | null;
  assigned_doctor: string | null;
  current_department: string | null;
  queue_position: number | null;
  clinical_notes: string | null;
  steps: Step[];
  orders: Order[];
}

const URGENCY_COLORS: Record<string, string> = {
  routine: "bg-primary/10 text-primary border-primary/25",
  urgent: "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/25",
  critical: "bg-destructive/10 text-destructive border-destructive/25",
};

const ORDER_STATUS_COLORS: Record<string, string> = {
  pending: "text-yellow-600 dark:text-yellow-400",
  in_progress: "text-primary",
  completed: "text-primary",
  cancelled: "text-muted-foreground",
};

interface VisitTrackerProps {
  visitId: string;
  initialData: TrackingData | null;
}

export function VisitTracker({ visitId, initialData }: VisitTrackerProps) {
  const [data, setData] = useState<TrackingData | null>(initialData);
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [pulse, setPulse] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`/api/track/${visitId}`);
      if (res.ok) {
        const fresh = await res.json();
        setData(fresh);
        setLastUpdated(new Date());
        setPulse(true);
        setTimeout(() => setPulse(false), 600);
      }
    } catch {
      // Silently ignore — stale data is better than a crash
    }
  }, [visitId]);

  useEffect(() => {
    if (!initialData) refresh();
    const id = setInterval(refresh, 10_000);
    return () => clearInterval(id);
  }, [refresh, initialData]);

  if (!data) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
          <span className="text-xs text-muted-foreground">Loading your visit…</span>
        </div>
      </div>
    );
  }

  const urgencyClass = data.urgency_level
    ? (URGENCY_COLORS[data.urgency_level] ?? URGENCY_COLORS.routine)
    : null;

  const statusLabel = data.status
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-border/50 bg-background/90 backdrop-blur-sm px-4 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="MediNexus" className="w-6 h-6 object-contain" />
          <span className="font-display font-semibold text-sm tracking-tight text-foreground">
            MEDI-NEXUS
          </span>
        </div>
        <div className="flex items-center gap-2">
          {/* Live update indicator */}
          <div className="flex items-center gap-1.5">
            <span
              className={`w-1.5 h-1.5 rounded-full bg-primary transition-all duration-300 ${
                pulse ? "scale-150 opacity-100" : "opacity-60"
              }`}
            />
            <span className="text-xs text-muted-foreground hidden sm:block">
              {lastUpdated.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </span>
          </div>
          <span className="text-xs text-muted-foreground/40 font-mono hidden sm:block">
            {data.visit_id}
          </span>
        </div>
      </header>

      <div className="max-w-md mx-auto px-4 py-6 space-y-5">
        {/* Patient identity */}
        <div className="space-y-2.5">
          <div>
            <h1 className="font-display text-2xl font-semibold tracking-tight text-foreground">
              {data.patient_name}
            </h1>
            <p className="text-xs text-muted-foreground font-mono mt-0.5">{data.visit_id}</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border bg-primary/8 text-primary border-primary/20">
              <Activity className="w-3 h-3" />
              {statusLabel}
            </span>
            {data.urgency_level && urgencyClass && (
              <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${urgencyClass}`}>
                {data.urgency_level.charAt(0).toUpperCase() + data.urgency_level.slice(1)}
              </span>
            )}
            {data.current_department && (
              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border border-border bg-muted text-muted-foreground capitalize">
                {data.current_department.replace(/_/g, " ")}
              </span>
            )}
          </div>
        </div>

        {/* Chief complaint */}
        {data.chief_complaint && (
          <div className="rounded-xl border border-border bg-card px-4 py-3">
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-widest mb-2">
              Chief Complaint
            </div>
            <p className="text-sm text-foreground/80 leading-relaxed italic">
              &ldquo;{data.chief_complaint}&rdquo;
            </p>
          </div>
        )}

        {/* Assigned doctor */}
        {data.assigned_doctor && (
          <div className="rounded-xl border border-border bg-card px-4 py-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0">
                <User className="w-4 h-4 text-primary" />
              </div>
              <div>
                <div className="text-xs font-medium text-muted-foreground uppercase tracking-widest">
                  Assigned Doctor
                </div>
                <div className="text-sm font-semibold text-foreground">{data.assigned_doctor}</div>
              </div>
            </div>
          </div>
        )}

        {/* Orders */}
        {data.orders.length > 0 && (
          <div className="rounded-xl border border-border bg-card px-4 py-3">
            <div className="flex items-center gap-2 mb-3">
              <FlaskConical className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-widest">
                Tests &amp; Orders
              </span>
            </div>
            <div className="space-y-2.5">
              {data.orders.map((order, i) => (
                <div key={i} className="flex justify-between items-center">
                  <span className="text-sm text-foreground">{order.order_name}</span>
                  <span
                    className={`text-xs font-medium capitalize ${
                      ORDER_STATUS_COLORS[order.status] ?? "text-muted-foreground"
                    }`}
                  >
                    {order.status.replace(/_/g, " ")}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Journey / Itinerary */}
        {data.steps.length > 0 && (
          <div>
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-widest mb-4">
              Your Journey Today
            </div>
            <div>
              {data.steps.map((step, i) => (
                <StepItem
                  key={step.id}
                  step={step}
                  isLast={i === data.steps.length - 1}
                  queuePosition={step.status === "active" ? data.queue_position : null}
                  clinicalNotes={step.status === "active" ? data.clinical_notes : null}
                />
              ))}
            </div>
          </div>
        )}

        {/* Completed state */}
        {data.status === "completed" && (
          <div className="rounded-xl border border-primary/25 bg-primary/8 px-4 py-4 text-center">
            <div className="font-display text-base font-semibold text-primary">
              Visit Complete
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Thank you for visiting. We hope you feel better soon.
            </p>
          </div>
        )}

        {/* Footer */}
        <p className="text-center text-xs text-muted-foreground/40 pb-4">
          Updates automatically every 10 seconds
        </p>
      </div>
    </div>
  );
}
