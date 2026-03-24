// web/components/pipeline/pipeline-constants.ts

export type VisitStatus =
  | "intake"
  | "triaged"
  | "auto_routed"
  | "pending_review"
  | "routed"
  | "in_department"
  | "completed";

export interface PipelineColumn {
  id: string;
  title: string;
  statuses: VisitStatus[];
  color: string;
  dotColor: string;
}

export const PIPELINE_COLUMNS: PipelineColumn[] = [
  {
    id: "intake",
    title: "Intake",
    statuses: ["intake", "triaged"],
    color: "#00d9ff",
    dotColor: "bg-cyan-400",
  },
  {
    id: "routing",
    title: "Routing",
    statuses: ["auto_routed"],
    color: "#a78bfa",
    dotColor: "bg-violet-400",
  },
  {
    id: "needs-review",
    title: "Needs Review",
    statuses: ["pending_review"],
    color: "#f59e0b",
    dotColor: "bg-amber-400",
  },
  {
    id: "routed",
    title: "Routed",
    statuses: ["routed"],
    color: "#10b981",
    dotColor: "bg-emerald-400",
  },
  {
    id: "in-department",
    title: "In Department",
    statuses: ["in_department"],
    color: "#6366f1",
    dotColor: "bg-indigo-400",
  },
];

export const STATUS_COLUMN_MAP: Record<string, string> = {};
for (const col of PIPELINE_COLUMNS) {
  for (const status of col.statuses) {
    STATUS_COLUMN_MAP[status] = col.id;
  }
}

export function getColumnForStatus(status: string): PipelineColumn | undefined {
  const colId = STATUS_COLUMN_MAP[status];
  return PIPELINE_COLUMNS.find((c) => c.id === colId);
}

export function formatTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
