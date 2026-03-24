"use client";

import { VisitListItem } from "@/lib/api";
import { PIPELINE_COLUMNS } from "./pipeline-constants";
import { VisitCard } from "./visit-card";
import { ScrollArea } from "@/components/ui/scroll-area";

interface KanbanBoardProps {
  visits: VisitListItem[];
  selectedVisitId: number | null;
  onSelectVisit: (visit: VisitListItem) => void;
}

export function KanbanBoard({
  visits,
  selectedVisitId,
  onSelectVisit,
}: KanbanBoardProps) {
  const getVisitsForColumn = (statuses: string[]) =>
    visits.filter((v) => statuses.includes(v.status));

  return (
    <div className="flex gap-3 h-full min-w-0">
      {PIPELINE_COLUMNS.map((column) => {
        const columnVisits = getVisitsForColumn(column.statuses);
        return (
          <div
            key={column.id}
            className="flex-1 min-w-0 flex flex-col rounded-xl bg-card/20 border border-border/30"
          >
            <div
              className="px-3 py-2.5 border-b border-border/30 flex items-center justify-between shrink-0"
              style={{ borderTopColor: column.color, borderTopWidth: 3, borderTopLeftRadius: 12, borderTopRightRadius: 12 }}
            >
              <span
                className="text-xs font-semibold tracking-wider uppercase"
                style={{ color: column.color }}
              >
                {column.title}
              </span>
              <span
                className="text-xs px-1.5 py-0.5 rounded-md"
                style={{
                  backgroundColor: `${column.color}15`,
                  color: column.color,
                }}
              >
                {columnVisits.length}
              </span>
            </div>

            <ScrollArea className="flex-1 min-h-0">
              <div className="p-2 space-y-2">
                {columnVisits.length === 0 ? (
                  <p className="text-xs text-muted-foreground/50 text-center py-6">
                    No visits
                  </p>
                ) : (
                  columnVisits.map((visit) => (
                    <VisitCard
                      key={visit.id}
                      visit={visit}
                      isSelected={visit.id === selectedVisitId}
                      onClick={() => onSelectVisit(visit)}
                    />
                  ))
                )}
              </div>
            </ScrollArea>
          </div>
        );
      })}
    </div>
  );
}
