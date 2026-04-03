"use client";

import { Check, MapPin, Loader2 } from "lucide-react";

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
    <div className="flex gap-4">
      {/* Timeline column */}
      <div className="flex flex-col items-center flex-shrink-0 w-7">
        {isDone ? (
          <div className="w-7 h-7 rounded-full bg-primary/15 border border-primary/30 flex items-center justify-center flex-shrink-0">
            <Check className="w-3.5 h-3.5 text-primary" strokeWidth={2.5} />
          </div>
        ) : isActive ? (
          <div className="relative w-7 h-7 flex-shrink-0">
            <div className="absolute inset-0 rounded-full bg-primary/20 animate-ping" style={{ animationDuration: "2s" }} />
            <div className="relative w-7 h-7 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-xs font-bold">
              {step.step_order}
            </div>
          </div>
        ) : (
          <div className="w-7 h-7 rounded-full border-2 border-border flex items-center justify-center flex-shrink-0">
            <span className="text-xs text-muted-foreground/50 font-medium">{step.step_order}</span>
          </div>
        )}
        {!isLast && (
          <div
            className={`w-px flex-1 mt-1.5 min-h-6 ${
              isDone ? "bg-primary/25" : "bg-border/60"
            }`}
          />
        )}
      </div>

      {/* Content column */}
      <div className="pb-6 flex-1 min-w-0">
        <div
          className={`text-sm font-semibold leading-tight ${
            isDone
              ? "text-muted-foreground line-through"
              : isActive
              ? "text-foreground"
              : "text-muted-foreground/50"
          }`}
        >
          {step.label}
        </div>

        {isDone && step.completed_at && (
          <div className="text-xs text-muted-foreground/60 mt-0.5 flex items-center gap-1">
            <Check className="w-2.5 h-2.5 text-primary/60" strokeWidth={2.5} />
            Completed ·{" "}
            {new Date(step.completed_at).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </div>
        )}

        {isActive && (
          <div className="mt-2.5 rounded-xl border border-primary/20 bg-primary/5 p-3.5 space-y-2.5">
            {step.description && (
              <p className="text-xs text-foreground/70 leading-relaxed">{step.description}</p>
            )}
            {step.room && (
              <div className="flex items-center gap-1.5 text-xs text-primary font-medium">
                <MapPin className="w-3 h-3" />
                {step.room}
              </div>
            )}
            {queuePosition != null && (
              <div className="flex items-center gap-2 pt-2 border-t border-primary/15">
                <Loader2 className="w-3 h-3 animate-spin text-primary" />
                <span className="text-xs text-primary font-medium">
                  {queuePosition === 1
                    ? "You're next!"
                    : `Position #${queuePosition} in queue`}
                </span>
              </div>
            )}
            {clinicalNotes && (
              <div className="pt-2 border-t border-primary/15">
                <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
                  Doctor&apos;s note
                </div>
                <p className="text-xs text-muted-foreground italic leading-relaxed">
                  &ldquo;{clinicalNotes}&rdquo;
                </p>
              </div>
            )}
          </div>
        )}

        {!isActive && !isDone && step.description && (
          <div className="text-xs text-muted-foreground/40 mt-0.5 leading-relaxed">
            {step.description}
          </div>
        )}
        {!isActive && !isDone && step.room && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground/30 mt-0.5">
            <MapPin className="w-2.5 h-2.5" />
            {step.room}
          </div>
        )}
      </div>
    </div>
  );
}
