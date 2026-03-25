// web/components/operations/use-hospital-canvas.ts
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Node, Edge } from "@xyflow/react";

import {
  listDepartments,
  listActiveVisits,
  getHospitalStats,
  type DepartmentInfo,
  type HospitalStats,
  type VisitListItem,
} from "@/lib/api";
import { CANVAS_LAYOUT, RECEPTION_STATUSES } from "./operations-constants";

export interface CanvasData {
  nodes: Node[];
  edges: Edge[];
  departments: DepartmentInfo[];
  visits: VisitListItem[];
  stats: HospitalStats;
  receptionVisits: VisitListItem[];
  departmentVisits: Record<string, VisitListItem[]>;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

const POLL_INTERVAL = 5000;

const SAVED_POSITIONS_KEY = "hospital-canvas-positions";

function loadSavedPositions(): Record<string, { x: number; y: number }> {
  try {
    const saved = localStorage.getItem(SAVED_POSITIONS_KEY);
    return saved ? JSON.parse(saved) : {};
  } catch {
    return {};
  }
}

function savePositions(positions: Record<string, { x: number; y: number }>) {
  localStorage.setItem(SAVED_POSITIONS_KEY, JSON.stringify(positions));
}

function buildDefaultLayout(departments: DepartmentInfo[]): Record<string, { x: number; y: number }> {
  const sorted = [...departments].sort((a, b) => a.name.localeCompare(b.name));
  const positions: Record<string, { x: number; y: number }> = {};

  // Reception at top center
  positions["reception"] = { x: CANVAS_LAYOUT.CENTER_X, y: CANVAS_LAYOUT.RECEPTION_Y };

  // Departments in 2 rows of 7
  sorted.forEach((dept, i) => {
    const row = Math.floor(i / CANVAS_LAYOUT.DEPARTMENTS_PER_ROW);
    const col = i % CANVAS_LAYOUT.DEPARTMENTS_PER_ROW;
    positions[dept.name] = {
      x: col * CANVAS_LAYOUT.DEPARTMENT_COL_GAP + 50,
      y: CANVAS_LAYOUT.DEPARTMENT_START_Y + row * CANVAS_LAYOUT.DEPARTMENT_ROW_GAP,
    };
  });

  // Discharge at bottom center
  positions["discharge"] = { x: CANVAS_LAYOUT.CENTER_X, y: CANVAS_LAYOUT.DISCHARGE_Y };

  return positions;
}

function buildNodes(
  departments: DepartmentInfo[],
  visits: VisitListItem[],
  positions: Record<string, { x: number; y: number }>,
): Node[] {
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

  const nodes: Node[] = [];

  // Reception node
  nodes.push({
    id: "reception",
    type: "reception",
    position: positions["reception"] || { x: CANVAS_LAYOUT.CENTER_X, y: CANVAS_LAYOUT.RECEPTION_Y },
    data: { visits: receptionVisits },
  });

  // Department nodes
  for (const dept of departments) {
    nodes.push({
      id: dept.name,
      type: "department",
      position: positions[dept.name] || { x: 0, y: 0 },
      data: {
        department: dept,
        visits: departmentVisits[dept.name] || [],
      },
    });
  }

  // Discharge node
  const dischargedToday = visits.filter((v) => v.status === "completed");
  nodes.push({
    id: "discharge",
    type: "discharge",
    position: positions["discharge"] || { x: CANVAS_LAYOUT.CENTER_X, y: CANVAS_LAYOUT.DISCHARGE_Y },
    data: { count: dischargedToday.length },
  });

  return nodes;
}

function buildEdges(departments: DepartmentInfo[], departmentVisits: Record<string, VisitListItem[]>): Edge[] {
  const edges: Edge[] = [];
  const maxCount = Math.max(1, ...Object.values(departmentVisits).map((v) => v.length));

  for (const dept of departments) {
    const count = (departmentVisits[dept.name] || []).length;
    edges.push({
      id: `reception-${dept.name}`,
      source: "reception",
      target: dept.name,
      type: "flow",
      data: { opacity: count > 0 ? 0.15 + (count / maxCount) * 0.6 : 0.08 },
      animated: true,
    });
  }

  return edges;
}

export function useHospitalCanvas(): CanvasData {
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
  const positionsRef = useRef<Record<string, { x: number; y: number }>>(loadSavedPositions());
  const initializedRef = useRef(false);

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

      // Initialize positions on first load if none saved
      if (!initializedRef.current && Object.keys(positionsRef.current).length === 0) {
        positionsRef.current = buildDefaultLayout(depts);
        savePositions(positionsRef.current);
      }
      initializedRef.current = true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch data");
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

  const nodes = buildNodes(departments, visits, positionsRef.current);
  const edges = buildEdges(departments, departmentVisits);

  return {
    nodes,
    edges,
    departments,
    visits,
    stats,
    receptionVisits,
    departmentVisits,
    loading,
    error,
    refresh: fetchData,
  };
}

/** Call this when a node is dragged to persist its position. */
export function onNodeDragStop(nodeId: string, position: { x: number; y: number }) {
  const positions = loadSavedPositions();
  positions[nodeId] = position;
  savePositions(positions);
}
