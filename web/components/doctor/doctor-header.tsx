"use client";

import { useState } from "react";
import { ChevronRight, LogOut } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { NotificationBell } from "@/components/notifications/notification-bell";
import type { NotificationItem } from "@/lib/ws-events";

interface DoctorHeaderProps {
  selectedPatientName?: string;
  bellItems?: NotificationItem[];
  unreadCount?: number;
  onMarkRead?: () => void;
  onClearBell?: (id: string) => void;
}

function getInitials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function DoctorHeader({
  selectedPatientName,
  bellItems = [],
  unreadCount = 0,
  onMarkRead = () => {},
  onClearBell = () => {},
}: DoctorHeaderProps) {
  const { user, logout } = useAuth();

  const initials = user?.name ? getInitials(user.name) : "DR";
  const rawName = user?.name ?? "Doctor";
  const displayName = rawName.replace(/^Dr\.?\s*/i, "");

  return (
    <header className="h-14 border-b border-border/50 flex items-center gap-4 px-5 shrink-0"
      style={{ background: "linear-gradient(90deg, hsl(var(--primary)/0.07) 0%, transparent 50%)" }}
    >
      {/* Doctor identity */}
      <div className="flex items-center gap-2.5 shrink-0">
        <div className="w-7 h-7 rounded-md bg-primary/15 border border-primary/25 flex items-center justify-center">
          <span className="text-[10px] font-bold tracking-wide text-primary">{initials}</span>
        </div>
        <div className="leading-tight">
          <p className="text-sm font-semibold text-foreground leading-none">
            Dr. {displayName}
          </p>
          <div className="flex items-center gap-1 mt-0.5">
            {selectedPatientName ? (
              <>
                <span className="text-[10px] text-muted-foreground/60">Viewing</span>
                <ChevronRight className="w-2.5 h-2.5 text-muted-foreground/40" />
                <span className="text-[10px] text-primary font-medium max-w-[140px] truncate">
                  {selectedPatientName}
                </span>
              </>
            ) : (
              <span className="text-[10px] uppercase tracking-widest text-muted-foreground/50 font-medium">
                Clinical Workstation
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Notification bell */}
      <NotificationBell
        items={bellItems}
        unreadCount={unreadCount}
        onMarkRead={onMarkRead}
        onClear={onClearBell}
      />

      {/* Log out */}
      <button
        onClick={logout}
        className="flex items-center gap-1.5 text-xs text-muted-foreground/60 hover:text-foreground transition-colors"
        title="Sign out"
      >
        <LogOut className="w-3.5 h-3.5" />
      </button>
    </header>
  );
}
