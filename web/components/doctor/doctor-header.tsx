"use client";

import { useState, useRef, useEffect } from "react";
import { Search, X, User } from "lucide-react";
import { Input } from "@/components/ui/input";
import type { Patient } from "@/lib/api";

interface DoctorHeaderProps {
  searchQuery: string;
  searchResults: Patient[];
  searchLoading: boolean;
  onSearch: (query: string) => void;
  onSelectPatient: (patient: Patient) => void;
  selectedPatientName?: string;
}

export function DoctorHeader({
  searchQuery,
  searchResults,
  searchLoading,
  onSearch,
  onSelectPatient,
  selectedPatientName,
}: DoctorHeaderProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Show dropdown when results arrive
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

  return (
    <div className="border-b border-border bg-gradient-to-r from-cyan-500/10 to-teal-500/10 px-6 py-4">
      <div className="flex items-center justify-between gap-6">
        {/* Title and selected patient context */}
        <div className="flex items-center gap-3 min-w-0">
          <h1 className="font-display text-lg font-semibold whitespace-nowrap">
            Doctor Workspace
          </h1>
          {selectedPatientName && (
            <span className="text-sm text-muted-foreground truncate">
              <User className="inline w-3.5 h-3.5 mr-1 -mt-0.5" />
              {selectedPatientName}
            </span>
          )}
        </div>

        {/* Patient search */}
        <div ref={containerRef} className="relative w-full max-w-md">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => onSearch(e.target.value)}
              onFocus={() => {
                if (searchResults.length > 0) setDropdownOpen(true);
              }}
              placeholder="Search patients by name or ID..."
              className="pl-9 pr-9 bg-card/50 border-border/50 focus:border-cyan-500/50"
            />
            {searchQuery && (
              <button
                onClick={handleClear}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Search results dropdown */}
          {dropdownOpen && (
            <div className="absolute z-50 top-full mt-1 w-full rounded-lg border border-border bg-card/95 backdrop-blur-xl shadow-lg overflow-hidden">
              {searchLoading ? (
                <div className="px-4 py-3 text-sm text-muted-foreground text-center">
                  Searching...
                </div>
              ) : searchResults.length === 0 ? (
                <div className="px-4 py-3 text-sm text-muted-foreground text-center">
                  No patients found
                </div>
              ) : (
                <ul className="max-h-64 overflow-y-auto">
                  {searchResults.map((patient) => (
                    <li key={patient.id}>
                      <button
                        onClick={() => handleSelect(patient)}
                        className="w-full px-4 py-3 text-left hover:bg-cyan-500/10 transition-colors flex items-center gap-3 border-b border-border/30 last:border-b-0"
                      >
                        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-cyan-500/20 flex items-center justify-center">
                          <User className="w-4 h-4 text-cyan-500" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">
                            {patient.name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            DOB: {patient.dob} | {patient.gender} | ID:{" "}
                            {patient.id}
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
      </div>
    </div>
  );
}
