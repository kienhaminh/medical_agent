"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Scan, Calendar, Image as ImageIcon } from "lucide-react";
import { FilterableList } from "@/components/medical/filterable-list";
import type { MedicalRecord } from "@/lib/api";

interface PatientImagingTabProps {
  imageRecords: MedicalRecord[];
  setUploadOpen: (open: boolean) => void;
  setViewerRecord: (record: MedicalRecord | null) => void;
}

export function PatientImagingTab({
  imageRecords,
  setUploadOpen,
  setViewerRecord,
}: PatientImagingTabProps) {
  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <h2 className="font-display text-xl font-semibold">Medical Imaging</h2>
        <Button onClick={() => setUploadOpen(true)} className="primary-button">
          <ImageIcon className="w-4 h-4 mr-2" />
          Upload Image
        </Button>
      </div>

      <FilterableList
        items={imageRecords}
        searchFields={["title", "description"]}
        filterOptions={[
          {
            label: "Imaging Type",
            field: "file_type",
            options: [
              { value: "all", label: "All Types" },
              { value: "mri", label: "MRI" },
              { value: "xray", label: "X-Ray" },
              { value: "ct_scan", label: "CT Scan" },
              { value: "ultrasound", label: "Ultrasound" },
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
                <div className="p-2 rounded-lg bg-purple-500/10 group-hover:bg-purple-500/20 transition-colors">
                  <Scan className="w-5 h-5 text-purple-500" />
                </div>
                <Badge
                  variant="secondary"
                  className={
                    record.file_type === "mri"
                      ? "medical-badge-mri"
                      : record.file_type === "xray"
                      ? "medical-badge-xray"
                      : "medical-badge-text"
                  }
                >
                  {record.file_type?.toUpperCase()}
                </Badge>
              </div>
              <h3 className="font-display font-semibold mb-2 group-hover:text-cyan-500 transition-colors">
                {record.title}
              </h3>
              {record.description && (
                <p className="text-sm text-muted-foreground line-clamp-3">
                  {record.description}
                </p>
              )}
              <div className="mt-3 text-xs text-muted-foreground">
                {new Date(record.created_at).toLocaleDateString()}
              </div>
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
                <div className="p-2.5 rounded-lg bg-purple-500/10 group-hover:bg-purple-500/20 transition-colors flex-shrink-0">
                  <Scan className="w-5 h-5 text-purple-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-display font-semibold truncate group-hover:text-cyan-500 transition-colors">
                      {record.title}
                    </h3>
                    <Badge
                      variant="secondary"
                      className={
                        record.file_type === "mri"
                          ? "medical-badge-mri"
                          : record.file_type === "xray"
                          ? "medical-badge-xray"
                          : "medical-badge-text"
                      }
                    >
                      {record.file_type?.toUpperCase()}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground truncate">
                    {record.description || "No description"}
                  </p>
                  <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {new Date(record.created_at).toLocaleDateString()}
                  </div>
                </div>
              </div>
            </Card>
          </button>
        )}
        emptyMessage="No imaging records found"
      />
    </>
  );
}
