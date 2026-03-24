"use client";

import { useState, useEffect, useCallback } from "react";
import { VisitListItem, listActiveVisits, listVisits } from "@/lib/api";
import { KanbanBoard } from "@/components/pipeline/kanban-board";
import { DetailPanel } from "@/components/pipeline/detail-panel";
import { Workflow } from "lucide-react";

export default function PipelinePage() {
  const [visits, setVisits] = useState<VisitListItem[]>([]);
  const [selectedVisit, setSelectedVisit] = useState<VisitListItem | null>(null);
  const [showCompleted, setShowCompleted] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchVisits = useCallback(async () => {
    try {
      const data = showCompleted
        ? (await listVisits()) as VisitListItem[]
        : await listActiveVisits();
      setVisits(data);

      if (selectedVisit) {
        const updated = data.find((v) => v.id === selectedVisit.id);
        if (updated) {
          setSelectedVisit(updated);
        }
      }
    } catch (err) {
      console.error("Failed to fetch visits:", err);
    } finally {
      setLoading(false);
    }
  }, [showCompleted, selectedVisit?.id]);

  useEffect(() => {
    fetchVisits();
    const interval = setInterval(fetchVisits, 5000);
    return () => clearInterval(interval);
  }, [fetchVisits]);

  const activeCount = visits.filter((v) => v.status !== "completed").length;

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-6 py-4 border-b border-border/50 shrink-0">
        <div className="flex items-center gap-3">
          <Workflow className="w-5 h-5 text-cyan-500" />
          <h1 className="text-lg font-semibold text-foreground">
            Visit Pipeline
          </h1>
          <span className="text-sm text-muted-foreground">
            {activeCount} active
          </span>
        </div>
        <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
          <input
            type="checkbox"
            checked={showCompleted}
            onChange={(e) => setShowCompleted(e.target.checked)}
            className="rounded border-border"
          />
          Show completed
        </label>
      </div>

      <div className="flex-1 min-h-0 flex">
        <div className="flex-[2] min-w-0 p-4">
          {loading ? (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              Loading visits...
            </div>
          ) : visits.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-3">
              <Workflow className="w-10 h-10 opacity-30" />
              <p className="text-sm">No active visits</p>
              <p className="text-xs">
                Visits will appear here when patients start conversations.
              </p>
            </div>
          ) : (
            <KanbanBoard
              visits={visits}
              selectedVisitId={selectedVisit?.id ?? null}
              onSelectVisit={setSelectedVisit}
            />
          )}
        </div>

        <div className="flex-[1.5] min-w-0 border-l border-border/50 p-4">
          <DetailPanel
            selectedVisit={selectedVisit}
            onVisitUpdated={fetchVisits}
          />
        </div>
      </div>
    </div>
  );
}
