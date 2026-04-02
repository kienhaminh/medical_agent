"use client";

import { useState, useRef, useEffect } from "react";
import { Search, X, ChevronRight, User, LogOut } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { NotificationBell } from "@/components/notifications/notification-bell";
import type { Patient } from "@/lib/api";
import type { NotificationItem } from "@/lib/ws-events";

interface DoctorHeaderProps {
  searchQuery: string;
  searchResults: Patient[];
  searchLoading: boolean;
  onSearch: (query: string) => void;
  onSelectPatient: (patient: Patient) => void;
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
  searchQuery,
  searchResults,
  searchLoading,
  onSearch,
  onSelectPatient,
  selectedPatientName,
  bellItems = [],
  unreadCount = 0,
  onMarkRead = () => {},
  onClearBell = () => {},
}: DoctorHeaderProps) {
  const { user, logout } = useAuth();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (searchResults.length > 0 && searchQuery.trim().length > 0) {
      setDropdownOpen(true);
    }
  }, [searchResults, searchQuery]);

  function handleSelect(patient: Patient) {
    setDropdownOpen(false);
    onSearch("");
    onSelectPatient(patient);
  }

  function handleClear() {
    onSearch("");
    setDropdownOpen(false);
  }

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

      {/* Divider */}
      <div className="h-7 w-px bg-border/50 shrink-0" />

      {/* Search */}
      <div ref={containerRef} className="relative flex-1 max-w-sm">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/50 pointer-events-none" />
        <input
          value={searchQuery}
          onChange={(e) => onSearch(e.target.value)}
          onFocus={() => { if (searchResults.length > 0) setDropdownOpen(true); }}
          placeholder="Search patients…"
          className="w-full h-8 pl-8 pr-8 text-sm bg-muted/40 border border-border/40 rounded-lg
                     placeholder:text-muted-foreground/35 text-foreground
                     focus:outline-none focus:border-primary/40 focus:bg-muted/60
                     transition-all"
        />
        {searchQuery && (
          <button
            onClick={handleClear}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground/50 hover:text-foreground transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}

        {/* Search dropdown */}
        {dropdownOpen && (
          <div className="absolute z-50 top-full mt-1.5 w-full min-w-[320px] rounded-lg border border-border/60
                          bg-card/95 backdrop-blur-xl shadow-2xl shadow-black/30 overflow-hidden">
            {searchLoading ? (
              <div className="px-4 py-3 text-xs text-muted-foreground text-center">Searching…</div>
            ) : searchResults.length === 0 ? (
              <div className="px-4 py-3 text-xs text-muted-foreground text-center">No patients found</div>
            ) : (
              <ul className="max-h-64 overflow-y-auto">
                {searchResults.map((patient) => (
                  <li key={patient.id}>
                    <button
                      onClick={() => handleSelect(patient)}
                      className="w-full px-3 py-2.5 text-left hover:bg-primary/8 transition-colors
                                 flex items-center gap-3 border-b border-border/20 last:border-b-0"
                    >
                      <div className="w-7 h-7 rounded-md bg-primary/15 border border-primary/20
                                      flex items-center justify-center shrink-0">
                        <User className="w-3.5 h-3.5 text-primary" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{patient.name}</p>
                        <p className="text-[10px] text-muted-foreground/60">
                          DOB: {patient.dob} · {patient.gender} · ID {patient.id}
                        </p>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
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
