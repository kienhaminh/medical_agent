"use client";

import { CheckCircle, Circle, MapPin, Loader2 } from "lucide-react";

export interface Step {
  id: number;
  step_order: number;
  label: string;
  description: string | null;
  room: string | null;
  department: string | null;
  status: "pending" | "active" | "done";
  completed_at: string | null;
}

interface StepItemProps {
  step: Step;
  isLast: boolean;
  queuePosition?: number | null;
  clinicalNotes?: string | null;
}

export function StepItem({ step, isLast, queuePosition, clinicalNotes }: StepItemProps) {
  const isDone = step.status === "done";
  const isActive = step.status === "active";

  return (
    <div className="flex gap-3">
      {/* Timeline column */}
      <div className="flex flex-col items-center flex-shrink-0 w-6">
        {isDone ? (
          <CheckCircle className="w-6 h-6 text-green-500 flex-shrink-0" />
        ) : isActive ? (
          <div className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center text-white text-xs font-bold ring-4 ring-blue-500/20 flex-shrink-0">
            {step.step_order}
          </div>
        ) : (
          <Circle className="w-6 h-6 text-muted-foreground/40 flex-shrink-0" />
        )}
        {!isLast && (
          <div className={`w-0.5 flex-1 mt-1 min-h-4 ${isDone ? "bg-green-500/30" : "bg-border"}`} />
        )}
      </div>

      {/* Content column */}
      <div className="pb-5 flex-1">
        <div
          className={`text-sm font-semibold ${
            isDone
              ? "line-through text-muted-foreground"
              : isActive
              ? "text-blue-400"
              : "text-muted-foreground/60"
          }`}
        >
          {step.label}
        </div>

        {isDone && step.completed_at && (
          <div className="text-xs text-muted-foreground mt-0.5">
            Completed &middot;{" "}
            {new Date(step.completed_at).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </div>
        )}

        {isActive && (
          <div className="mt-2 rounded-lg border border-blue-500/30 bg-blue-950/40 p-3 space-y-2">
            {step.description && (
              <p className="text-xs text-blue-300">{step.description}</p>
            )}
            {step.room && (
              <div className="flex items-center gap-1.5 text-xs text-blue-400">
                <MapPin className="w-3 h-3" />
                {step.room}
              </div>
            )}
            {queuePosition != null && (
              <div className="flex items-center gap-2 pt-1 border-t border-blue-500/20">
                <Loader2 className="w-3 h-3 animate-spin text-blue-400" />
                <span className="text-xs text-blue-300">
                  {queuePosition === 1
                    ? "You're next!"
                    : `Queue position #${queuePosition}`}
                </span>
              </div>
            )}
            {clinicalNotes && (
              <div className="pt-2 border-t border-blue-500/20">
                <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
                  Doctor&apos;s note
                </div>
                <p className="text-xs text-slate-300 italic">
                  &quot;{clinicalNotes}&quot;
                </p>
              </div>
            )}
          </div>
        )}

        {!isActive && !isDone && step.description && (
          <div className="text-xs text-muted-foreground/50 mt-0.5">
            {step.description}
          </div>
        )}

        {!isActive && !isDone && step.room && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground/40 mt-0.5">
            <MapPin className="w-2.5 h-2.5" />
            {step.room}
          </div>
        )}
      </div>
    </div>
  );
}
