// web/components/operations/use-operations-dashboard.ts
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  listDepartments,
  listActiveVisits,
  getHospitalStats,
  type DepartmentInfo,
  type HospitalStats,
  type VisitListItem,
} from "@/lib/api";
import { RECEPTION_STATUSES } from "./operations-constants";

export interface DashboardData {
  departments: DepartmentInfo[];
  stats: HospitalStats;
  receptionVisits: VisitListItem[];
  departmentVisits: Record<string, VisitListItem[]>;
  loading: boolean;
  error: string | null;
  lastUpdated: Date | null;
  refresh: () => Promise<void>;
}

const POLL_INTERVAL = 5000;

export function useOperationsDashboard(): DashboardData {
  const [departments, setDepartments] = useState<DepartmentInfo[]>([]);
  const [visits, setVisits] = useState<VisitListItem[]>([]);
  const [stats, setStats] = useState<HospitalStats>({
    active_patients: 0,
    departments_at_capacity: 0,
    avg_wait_minutes: 0,
    discharged_today: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  // Track whether we've had at least one successful load
  const hasLoadedRef = useRef(false);

  const fetchData = useCallback(async () => {
    try {
      const [depts, vis, st] = await Promise.all([
        listDepartments(),
        listActiveVisits(),
        getHospitalStats(),
      ]);
      setDepartments(depts);
      setVisits(vis);
      setStats(st);
      setError(null);
      setLastUpdated(new Date());
      hasLoadedRef.current = true;
    } catch (err) {
      // Only surface error on first load; keep stale data on poll failures
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

  const receptionVisits = visits.filter((v) =>
    (RECEPTION_STATUSES as readonly string[]).includes(v.status)
  );

  const departmentVisits: Record<string, VisitListItem[]> = {};
  visits
    .filter((v) => v.status === "in_department" && v.current_department)
    .forEach((v) => {
      const dept = v.current_department!;
      if (!departmentVisits[dept]) departmentVisits[dept] = [];
      departmentVisits[dept].push(v);
    });

  return {
    departments,
    stats,
    receptionVisits,
    departmentVisits,
    loading,
    error,
    lastUpdated,
    refresh: fetchData,
  };
}
