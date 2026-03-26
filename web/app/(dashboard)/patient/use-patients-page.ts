"use client";

import { useEffect, useState } from "react";
import { getPatients, type Patient } from "@/lib/api";
import { getAllMockPatients } from "@/lib/mock-data";

export function usePatientsPage() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [filteredPatients, setFilteredPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [showFilters, setShowFilters] = useState(false);
  const [genderFilter, setGenderFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("name");

  useEffect(() => { loadPatients(); }, []);

  useEffect(() => {
    let filtered = [...patients];

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (p) =>
          p.name.toLowerCase().includes(query) ||
          p.dob.includes(query) ||
          p.gender.toLowerCase().includes(query)
      );
    }

    if (genderFilter !== "all") {
      filtered = filtered.filter((p) => p.gender === genderFilter);
    }

    filtered.sort((a, b) => {
      switch (sortBy) {
        case "name": return a.name.localeCompare(b.name);
        case "dob": return new Date(a.dob).getTime() - new Date(b.dob).getTime();
        case "recent": return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        default: return 0;
      }
    });

    setFilteredPatients(filtered);
  }, [searchQuery, patients, genderFilter, sortBy]);

  async function loadPatients() {
    setLoading(true);
    try {
      try {
        const data = await getPatients();
        setPatients(data);
      } catch {
        setPatients(getAllMockPatients());
      }
    } finally {
      setLoading(false);
    }
  }

  const activeFilterCount = (genderFilter !== "all" ? 1 : 0) + (sortBy !== "name" ? 1 : 0);

  return {
    patients,
    filteredPatients,
    loading,
    isCreating,
    setIsCreating,
    searchQuery,
    setSearchQuery,
    viewMode,
    setViewMode,
    showFilters,
    setShowFilters,
    genderFilter,
    setGenderFilter,
    sortBy,
    setSortBy,
    activeFilterCount,
    loadPatients,
  };
}
