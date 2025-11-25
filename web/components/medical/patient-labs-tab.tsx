"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileHeart, Calendar, Upload } from "lucide-react";
import { FilterableList } from "@/components/medical/filterable-list";
import type { MedicalRecord } from "@/lib/api";

interface PatientLabsTabProps {
  pdfRecords: MedicalRecord[];
  setUploadOpen: (open: boolean) => void;
  setViewerRecord: (record: MedicalRecord | null) => void;
}

export function PatientLabsTab({
  pdfRecords,
  setUploadOpen,
  setViewerRecord,
}: PatientLabsTabProps) {
  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <h2 className="font-display text-xl font-semibold">Lab Results</h2>
        <Button onClick={() => setUploadOpen(true)} className="primary-button">
          <Upload className="w-4 h-4 mr-2" />
          Upload Lab Report
        </Button>
      </div>

      <FilterableList
        items={pdfRecords}
        searchFields={["title", "description"]}
        filterOptions={[
          {
            label: "Report Type",
            field: "file_type",
            options: [
              { value: "all", label: "All Types" },
              { value: "lab_report", label: "Lab Report" },
              { value: "other", label: "Other" },
            ],
          },
        ]}
        sortOptions={[
          {
            value: "recent",
            label: "Most Recent",
            compareFn: (a, b) =>
              new Date(b.created_at).getTime() -
              new Date(a.created_at).getTime(),
          },
          {
            value: "oldest",
            label: "Oldest First",
            compareFn: (a, b) =>
              new Date(a.created_at).getTime() -
              new Date(b.created_at).getTime(),
          },
          {
            value: "name",
            label: "Name (A-Z)",
            compareFn: (a, b) => a.title.localeCompare(b.title),
          },
        ]}
        renderGridItem={(record) => (
          <button
            onClick={() => setViewerRecord(record)}
            className="text-left w-full"
          >
            <Card className="record-card group p-4 h-full">
              <div className="flex items-start justify-between mb-3">
                <div className="p-2 rounded-lg bg-teal-500/10 group-hover:bg-teal-500/20 transition-colors">
                  <FileHeart className="w-5 h-5 text-teal-500" />
                </div>
                <span className="text-xs text-muted-foreground">
                  {new Date(record.created_at).toLocaleDateString()}
                </span>
              </div>
              <h3 className="font-display font-semibold mb-2 group-hover:text-cyan-500 transition-colors">
                {record.title}
              </h3>
              {record.description && (
                <p className="text-sm text-muted-foreground line-clamp-3">
                  {record.description}
                </p>
              )}
            </Card>
          </button>
        )}
        renderListItem={(record) => (
          <button
            onClick={() => setViewerRecord(record)}
            className="text-left w-full"
          >
            <Card className="record-card group p-4 hover:scale-[1.01] transition-all">
              <div className="flex items-center gap-4">
                <div className="p-2.5 rounded-lg bg-teal-500/10 group-hover:bg-teal-500/20 transition-colors flex-shrink-0">
                  <FileHeart className="w-5 h-5 text-teal-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-display font-semibold truncate group-hover:text-cyan-500 transition-colors">
                    {record.title}
                  </h3>
                  <p className="text-sm text-muted-foreground truncate">
                    {record.description || "No description"}
                  </p>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground mt-1">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {new Date(record.created_at).toLocaleDateString()}
                    </span>
                    <Badge variant="secondary" className="medical-badge-text">
                      {record.file_type}
                    </Badge>
                  </div>
                </div>
              </div>
            </Card>
          </button>
        )}
        emptyMessage="No lab results found"
      />
    </>
  );
}
