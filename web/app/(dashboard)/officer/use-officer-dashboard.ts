"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  listDepartments,
  listActiveVisits,
  getExtendedStats,
  type DepartmentInfo,
  type VisitListItem,
  type ExtendedHospitalStats,
} from "@/lib/api";

export type OfficerTab = "overview" | "patient-flow";

const POLL_INTERVAL = 30_000;

const DEFAULT_STATS: ExtendedHospitalStats = {
  active_patients: 0,
  departments_at_capacity: 0,
  avg_wait_minutes: 0,
  discharged_today: 0,
  total_beds: 0,
  occupied_beds: 0,
  occupancy_rate: 0,
  visits_by_status: {},
};

export function useOfficerDashboard() {
  const [activeTab, setActiveTab] = useState<OfficerTab>("overview");
  const [departments, setDepartments] = useState<DepartmentInfo[]>([]);
  const [visits, setVisits] = useState<VisitListItem[]>([]);
  const [stats, setStats] = useState<ExtendedHospitalStats>(DEFAULT_STATS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const hasLoadedRef = useRef(false);

  const fetchData = useCallback(async () => {
    try {
      const [depts, vis, st] = await Promise.all([
        listDepartments(),
        listActiveVisits(),
        getExtendedStats(),
      ]);
      setDepartments(depts);
      setVisits(vis);
      setStats(st);
      setError(null);
      setLastUpdated(new Date());
      hasLoadedRef.current = true;
    } catch (err) {
      if (!hasLoadedRef.current) {
        setError(err instanceof Error ? err.message : "Failed to fetch data");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchData]);

  // Group visits by status for Kanban
  const visitsByStatus: Record<string, VisitListItem[]> = {};
  for (const visit of visits) {
    if (!visitsByStatus[visit.status]) visitsByStatus[visit.status] = [];
    visitsByStatus[visit.status].push(visit);
  }

  // Department visits map
  const departmentVisits: Record<string, VisitListItem[]> = {};
  visits
    .filter((v) => v.status === "in_department" && v.current_department)
    .forEach((v) => {
      const dept = v.current_department!;
      if (!departmentVisits[dept]) departmentVisits[dept] = [];
      departmentVisits[dept].push(v);
    });

  return {
    activeTab,
    setActiveTab,
    departments,
    visits,
    stats,
    visitsByStatus,
    departmentVisits,
    loading,
    error,
    lastUpdated,
    refresh: fetchData,
  };
}
