"use client";

import { AlertTriangle, X, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ToastItem } from "@/lib/ws-events";

interface ToastNotificationProps {
  toasts: ToastItem[];
  onDismiss: (id: string) => void;
}

export function ToastNotification({ toasts, onDismiss }: ToastNotificationProps) {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 w-80">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={cn(
            "flex items-start gap-3 rounded-lg border p-3 shadow-lg backdrop-blur-xl animate-in slide-in-from-right-5 duration-300",
            toast.severity === "critical" && "border-red-500/30 bg-red-950/80 text-red-100",
            toast.severity === "warning" && "border-amber-500/30 bg-amber-950/80 text-amber-100",
            toast.severity === "info" && "border-border bg-card/95 text-foreground",
          )}
        >
          {toast.severity === "critical" ? (
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-red-400" />
          ) : toast.severity === "warning" ? (
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-amber-400" />
          ) : (
            <Info className="h-4 w-4 shrink-0 mt-0.5 text-primary" />
          )}

          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold">{toast.title}</p>
            <p className="text-xs opacity-80 mt-0.5 truncate">{toast.description}</p>
          </div>

          <button
            onClick={() => onDismiss(toast.id)}
            className="shrink-0 opacity-60 hover:opacity-100 transition-opacity"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}
