"use client";

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Scan, Calendar } from "lucide-react";
import { FilterableList } from "@/components/medical/filterable-list";
import type { Imaging } from "@/lib/api";

interface ImagingRecordsListProps {
  records: Imaging[];
  setViewerRecord: (r: Imaging) => void;
}

export function ImagingRecordsList({ records, setViewerRecord }: ImagingRecordsListProps) {
  return (
    <FilterableList
      items={records}
      keyExtractor={(r) => r.id}
      searchFields={["title"]}
      filterOptions={[
        {
          label: "Imaging Type",
          field: "image_type",
          options: [
            { value: "all", label: "All Types" },
            { value: "mri", label: "MRI" },
            { value: "xray", label: "X-Ray" },
            { value: "ct_scan", label: "CT Scan" },
            { value: "ultrasound", label: "Ultrasound" },
            { value: "t1", label: "T1" },
            { value: "t1ce", label: "T1CE" },
            { value: "t2", label: "T2" },
            { value: "flair", label: "FLAIR" },
          ],
        },
      ]}
      sortOptions={[
        {
          value: "recent",
          label: "Most Recent",
          compareFn: (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
        },
        {
          value: "oldest",
          label: "Oldest First",
          compareFn: (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
        },
        {
          value: "name",
          label: "Name (A-Z)",
          compareFn: (a, b) => a.title.localeCompare(b.title),
        },
      ]}
      renderGridItem={(record) => (
        <button onClick={() => setViewerRecord(record)} className="text-left w-full">
          <Card className="record-card group p-4 h-full">
            <div className="flex items-start justify-between mb-3">
              <div className="p-2 rounded-lg bg-purple-500/10 group-hover:bg-purple-500/20 transition-colors">
                <Scan className="w-5 h-5 text-purple-500" />
              </div>
              <Badge variant={record.image_type === "mri" ? "mri" : record.image_type === "xray" ? "xray" : "default"}>
                {record.image_type?.toUpperCase()}
              </Badge>
            </div>
            <h3 className="font-display font-semibold mb-2 group-hover:text-cyan-500 transition-colors">
              {record.title}
            </h3>
            <div className="relative w-full h-64 mb-3 bg-muted rounded-md overflow-hidden">
              <img src={record.preview_url} alt={record.title} className="w-full h-full object-contain" />
            </div>
            <div className="mt-3 text-xs text-muted-foreground">
              {new Date(record.created_at).toLocaleDateString()}
            </div>
          </Card>
        </button>
      )}
      renderListItem={(record) => (
        <button onClick={() => setViewerRecord(record)} className="text-left w-full">
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
                  <Badge variant={record.image_type === "mri" ? "mri" : record.image_type === "xray" ? "xray" : "default"}>
                    {record.image_type?.toUpperCase()}
                  </Badge>
                </div>
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
  );
}
