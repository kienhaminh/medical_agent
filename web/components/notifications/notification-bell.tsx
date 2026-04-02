"use client";

import { useState, useRef, useEffect } from "react";
import { Bell } from "lucide-react";
import { cn } from "@/lib/utils";
import type { NotificationItem } from "@/lib/ws-events";

interface NotificationBellProps {
  items: NotificationItem[];
  unreadCount: number;
  onMarkRead: () => void;
  onClear: (id: string) => void;
}

function timeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function NotificationBell({ items, unreadCount, onMarkRead, onClear }: NotificationBellProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={() => {
          setOpen(!open);
          if (!open && unreadCount > 0) onMarkRead();
        }}
        className={cn(
          "relative flex h-9 w-9 items-center justify-center rounded-lg transition-colors",
          "hover:bg-muted text-muted-foreground hover:text-foreground",
        )}
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-white">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 rounded-lg border border-border bg-card/95 backdrop-blur-xl shadow-xl z-50">
          <div className="flex items-center justify-between border-b border-border px-3 py-2">
            <span className="text-xs font-medium text-muted-foreground">Notifications</span>
            {items.length > 0 && (
              <button
                onClick={onMarkRead}
                className="text-xs text-primary hover:text-primary transition-colors"
              >
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto">
            {items.length === 0 ? (
              <div className="py-8 text-center text-xs text-muted-foreground">
                No notifications
              </div>
            ) : (
              items.map((item) => (
                <div
                  key={item.id}
                  className={cn(
                    "flex items-start gap-2 border-b border-border/50 px-3 py-2 transition-colors",
                    !item.read && "bg-primary/5",
                    "hover:bg-muted/50",
                  )}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">{item.title}</p>
                    <p className="text-xs text-muted-foreground truncate">{item.description}</p>
                    <p className="text-[10px] text-muted-foreground/60 mt-0.5">
                      {timeAgo(item.timestamp)}
                    </p>
                  </div>
                  <button
                    onClick={() => onClear(item.id)}
                    className="shrink-0 text-muted-foreground/40 hover:text-muted-foreground text-xs mt-0.5"
                  >
                    ×
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
