"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Stethoscope, User, Calendar, Plus } from "lucide-react";
import { FilterableList } from "@/components/medical/filterable-list";
import type { PatientVisit } from "@/lib/api";

interface PatientVisitsTabProps {
  visits: PatientVisit[];
  setTextEditorOpen: (open: boolean) => void;
  setSelectedVisit: (visit: PatientVisit | null) => void;
}

export function PatientVisitsTab({
  visits,
  setTextEditorOpen,
  setSelectedVisit,
}: PatientVisitsTabProps) {
  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <h2 className="font-display text-xl font-semibold">Patient Visits</h2>
        <Button
          onClick={() => setTextEditorOpen(true)}
          className="primary-button"
        >
          <Plus className="w-4 h-4 mr-2" />
          New Visit Note
        </Button>
      </div>

      <FilterableList
        items={visits}
        searchFields={["chief_complaint", "diagnosis", "doctor_name", "notes"]}
        filterOptions={[
          {
            label: "Visit Type",
            field: "visit_type",
            options: [
              { value: "all", label: "All Types" },
              { value: "routine", label: "Routine" },
              { value: "emergency", label: "Emergency" },
              { value: "follow-up", label: "Follow-up" },
              { value: "consultation", label: "Consultation" },
            ],
          },
          {
            label: "Status",
            field: "status",
            options: [
              { value: "all", label: "All Statuses" },
              { value: "completed", label: "Completed" },
              { value: "scheduled", label: "Scheduled" },
              { value: "cancelled", label: "Cancelled" },
            ],
          },
        ]}
        sortOptions={[
          {
            value: "recent",
            label: "Most Recent",
            compareFn: (a, b) =>
              new Date(b.visit_date).getTime() -
              new Date(a.visit_date).getTime(),
          },
          {
            value: "oldest",
            label: "Oldest First",
            compareFn: (a, b) =>
              new Date(a.visit_date).getTime() -
              new Date(b.visit_date).getTime(),
          },
        ]}
        renderGridItem={(visit) => (
          <button
            onClick={() => setSelectedVisit(visit)}
            className="text-left w-full"
          >
            <Card className="record-card group p-4 h-full">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-cyan-500/10 group-hover:bg-cyan-500/20 transition-colors">
                    <Stethoscope className="w-4 h-4 text-cyan-500" />
                  </div>
                  <Badge
                    variant="secondary"
                    className={
                      visit.visit_type === "emergency"
                        ? "bg-red-500/10 text-red-500 border-red-500/30"
                        : "medical-badge-text"
                    }
                  >
                    {visit.visit_type}
                  </Badge>
                </div>
                <span className="text-xs text-muted-foreground">
                  {new Date(visit.visit_date).toLocaleDateString()}
                </span>
              </div>
              <h3 className="font-display font-semibold mb-1.5 group-hover:text-cyan-500 transition-colors">
                {visit.chief_complaint}
              </h3>
              <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                {visit.diagnosis}
              </p>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground flex items-center gap-1">
                  <User className="w-3 h-3" />
                  {visit.doctor_name}
                </span>
                <Badge
                  variant="secondary"
                  className={
                    visit.status === "completed"
                      ? "bg-green-500/10 text-green-500 border-green-500/30"
                      : "medical-badge-text"
                  }
                >
                  {visit.status}
                </Badge>
              </div>
            </Card>
          </button>
        )}
        renderListItem={(visit) => (
          <button
            onClick={() => setSelectedVisit(visit)}
            className="text-left w-full"
          >
            <Card className="record-card group p-4 hover:scale-[1.01] transition-all">
              <div className="flex items-center gap-4">
                <div className="p-2.5 rounded-lg bg-cyan-500/10 group-hover:bg-cyan-500/20 transition-colors flex-shrink-0">
                  <Stethoscope className="w-5 h-5 text-cyan-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-display font-semibold truncate group-hover:text-cyan-500 transition-colors">
                      {visit.chief_complaint}
                    </h3>
                    <Badge
                      variant="secondary"
                      className="medical-badge-text flex-shrink-0"
                    >
                      {visit.visit_type}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground truncate mb-1">
                    {visit.diagnosis}
                  </p>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {new Date(visit.visit_date).toLocaleDateString()}
                    </span>
                    <span className="flex items-center gap-1">
                      <User className="w-3 h-3" />
                      {visit.doctor_name}
                    </span>
                    <Badge
                      variant="secondary"
                      className={
                        visit.status === "completed"
                          ? "bg-green-500/10 text-green-500 border-green-500/30"
                          : ""
                      }
                    >
                      {visit.status}
                    </Badge>
                  </div>
                </div>
              </div>
            </Card>
          </button>
        )}
        emptyMessage="No visits found"
      />
    </>
  );
}
