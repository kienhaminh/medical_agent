"use client";

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileText, FileImage, Eye } from "lucide-react";
import { format } from "date-fns";
import type { MedicalRecord } from "@/lib/api";

interface RecordGridProps {
  records: MedicalRecord[];
  onRecordClick: (record: MedicalRecord) => void;
}

export function RecordGrid({ records, onRecordClick }: RecordGridProps) {
  if (records.length === 0) {
    return (
      <div className="text-center py-16">
        <div className="inline-flex p-4 rounded-full bg-muted/50 mb-4">
          <FileText className="w-8 h-8 text-muted-foreground" />
        </div>
        <p className="text-muted-foreground">No records found</p>
        <p className="text-sm text-muted-foreground mt-1">
          Upload medical images or add clinical notes to get started
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {records.map((record) => (
        <Card
          key={record.id}
          className="record-card cursor-pointer"
          onClick={() => onRecordClick(record)}
        >
          {/* Thumbnail/Icon */}
          <div className="relative aspect-video rounded-lg overflow-hidden mb-4 bg-muted/30 flex items-center justify-center">
            {record.record_type === "image" && record.file_url ? (
              <img
                src={record.file_url}
                alt={record.title}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="p-8">
                {record.record_type === "image" ? (
                  <FileImage className="w-16 h-16 text-cyan-500" />
                ) : record.record_type === "pdf" ? (
                  <FileText className="w-16 h-16 text-purple-500" />
                ) : (
                  <FileText className="w-16 h-16 text-gray-500" />
                )}
              </div>
            )}

            {/* Overlay on hover */}
            <div className="absolute inset-0 bg-black/60 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center">
              <Eye className="w-8 h-8 text-white" />
            </div>
          </div>

          {/* Record Info */}
          <div className="space-y-3">
            <div>
              <h3 className="font-display font-semibold line-clamp-1">{record.title}</h3>
              {record.description && (
                <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                  {record.description}
                </p>
              )}
            </div>

            <div className="flex items-center justify-between">
              <Badge
                variant="secondary"
                className={
                  record.file_type === "mri"
                    ? "medical-badge-mri"
                    : record.file_type === "xray"
                    ? "medical-badge-xray"
                    : record.file_type === "lab_report"
                    ? "medical-badge-lab"
                    : "medical-badge-text"
                }
              >
                {record.file_type?.toUpperCase() || record.record_type.toUpperCase()}
              </Badge>

              <span className="text-xs text-muted-foreground">
                {format(new Date(record.created_at), "MMM d, yyyy")}
              </span>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
