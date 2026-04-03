"use client";

import { useEffect, useState, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { User, FlaskConical } from "lucide-react";
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
  routine: "bg-green-950 text-green-400 border-green-800",
  urgent: "bg-yellow-950 text-yellow-400 border-yellow-800",
  critical: "bg-red-950 text-red-400 border-red-800",
};

const ORDER_STATUS_COLORS: Record<string, string> = {
  pending: "text-yellow-400",
  in_progress: "text-blue-400",
  completed: "text-green-400",
  cancelled: "text-muted-foreground",
};

interface VisitTrackerProps {
  visitId: string;
  initialData: TrackingData | null;
}

export function VisitTracker({ visitId, initialData }: VisitTrackerProps) {
  const [data, setData] = useState<TrackingData | null>(initialData);
  const [lastUpdated, setLastUpdated] = useState(new Date());

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`/api/track/${visitId}`);
      if (res.ok) {
        const fresh = await res.json();
        setData(fresh);
        setLastUpdated(new Date());
      }
    } catch {
      // Silently ignore network errors — stale data is better than a crash
    }
  }, [visitId]);

  // Poll every 10 seconds; also fetch immediately if SSR data was unavailable
  useEffect(() => {
    if (!initialData) refresh();
    const id = setInterval(refresh, 10_000);
    return () => clearInterval(id);
  }, [refresh, initialData]);

  if (!data) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
        <div className="w-6 h-6 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  const urgencyClass = data.urgency_level
    ? (URGENCY_COLORS[data.urgency_level] ?? URGENCY_COLORS.routine)
    : URGENCY_COLORS.routine;

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <div className="border-b border-border/50 px-4 py-3 flex justify-between items-center">
        <span className="font-semibold text-sm">City Hospital</span>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">{data.visit_id}</span>
          <span className="text-xs text-muted-foreground/50">
            &middot;{" "}
            {lastUpdated.toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-5 space-y-4">
        {/* Patient info */}
        <div>
          <h1 className="text-xl font-bold">{data.patient_name}</h1>
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            <Badge
              variant="outline"
              className="text-blue-400 border-blue-800 bg-blue-950"
            >
              {data.status.replace(/_/g, " ")}
            </Badge>
            {data.urgency_level && (
              <Badge variant="outline" className={urgencyClass}>
                {data.urgency_level.charAt(0).toUpperCase() +
                  data.urgency_level.slice(1)}
              </Badge>
            )}
          </div>
        </div>

        {/* Chief complaint */}
        {data.chief_complaint && (
          <Card className="px-4 py-3 border-l-2 border-l-muted-foreground/30 rounded-l-none">
            <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
              Chief Complaint
            </div>
            <p className="text-sm text-muted-foreground">
              &quot;{data.chief_complaint}&quot;
            </p>
          </Card>
        )}

        {/* Assigned doctor */}
        {data.assigned_doctor && (
          <Card className="px-4 py-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <User className="w-4 h-4 text-primary" />
              </div>
              <div>
                <div className="text-xs text-muted-foreground uppercase tracking-wider">
                  Assigned Doctor
                </div>
                <div className="text-sm font-semibold">{data.assigned_doctor}</div>
                {data.current_department && (
                  <div className="text-xs text-muted-foreground capitalize">
                    {data.current_department.replace(/_/g, " ")}
                  </div>
                )}
              </div>
            </div>
          </Card>
        )}

        {/* Orders */}
        {data.orders.length > 0 && (
          <Card className="px-4 py-3">
            <div className="flex items-center gap-2 mb-3">
              <FlaskConical className="w-4 h-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground uppercase tracking-wider">
                Tests &amp; Orders
              </span>
            </div>
            <div className="space-y-2">
              {data.orders.map((order, i) => (
                <div key={i} className="flex justify-between items-center">
                  <div className="text-sm">{order.order_name}</div>
                  <div
                    className={`text-xs font-medium ${
                      ORDER_STATUS_COLORS[order.status] ?? "text-muted-foreground"
                    }`}
                  >
                    {order.status.replace(/_/g, " ")}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Itinerary */}
        {data.steps.length > 0 && (
          <div>
            <div className="text-xs text-muted-foreground uppercase tracking-wider mb-3">
              Your Journey Today
            </div>
            <div>
              {data.steps.map((step, i) => (
                <StepItem
                  key={step.id}
                  step={step}
                  isLast={i === data.steps.length - 1}
                  queuePosition={
                    step.status === "active" ? data.queue_position : null
                  }
                  clinicalNotes={
                    step.status === "active" ? data.clinical_notes : null
                  }
                />
              ))}
            </div>
          </div>
        )}

        {/* Completed state */}
        {data.status === "completed" && (
          <Card className="px-4 py-4 text-center border-green-800 bg-green-950/30">
            <div className="text-green-400 font-semibold">Visit Complete</div>
            <p className="text-sm text-muted-foreground mt-1">
              Thank you for visiting. We hope you feel better soon!
            </p>
          </Card>
        )}
      </div>
    </div>
  );
}
