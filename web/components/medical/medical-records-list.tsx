"use client";

import { useState } from "react";
import { MedicalRecord } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  FileText,
  Grid3x3,
  List,
  Search,
  X,
  Microscope,
  Stethoscope,
  FileHeart,
} from "lucide-react";
import { ClinicalNoteViewer } from "./clinical-note-viewer";
import { MedicalRecordCard } from "./medical-record-card";

interface MedicalRecordsListProps {
  records: MedicalRecord[];
}

export function MedicalRecordsList({ records }: MedicalRecordsListProps) {
  const [selectedRecord, setSelectedRecord] = useState<MedicalRecord | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("list");
  const [filterType, setFilterType] = useState<"all" | "registration" | "encounter" | "labs">("all");

  // Filter text records only
  const textRecords = records.filter((r) => r.record_type === "text");

  // Apply filters
  const filteredRecords = textRecords.filter((record) => {
    const matchesSearch =
      !searchQuery ||
      record.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      record.content?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesType =
      filterType === "all" ||
      (filterType === "registration" && record.title?.includes("Registration")) ||
      (filterType === "encounter" &&
        record.title?.includes("-") &&
        !record.title?.includes("Registration") &&
        !record.title?.includes("Routine")) ||
      (filterType === "labs" && record.title?.includes("Routine"));

    return matchesSearch && matchesType;
  });

  function getDetailIcon(record: MedicalRecord) {
    const summary = record.title?.toLowerCase() || "";
    if (summary.includes("registration")) return <FileHeart className="w-5 h-5 text-purple-500" />;
    if (summary.includes("routine") || summary.includes("laboratory")) return <Microscope className="w-5 h-5 text-primary" />;
    return <Stethoscope className="w-5 h-5 text-primary" />;
  }

  return (
    <>
      <div className="space-y-6">
        {/* Search and Filters */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search medical records..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant={filterType === "all" ? "default" : "outline"}
              size="sm"
              onClick={() => setFilterType("all")}
            >
              All
            </Button>
            <Button
              size="sm"
              onClick={() => setFilterType("registration")}
              variant={filterType === "registration" ? "default" : "outline"}
            >
              Registration
            </Button>
            <Button
              size="sm"
              onClick={() => setFilterType("encounter")}
              variant={filterType === "encounter" ? "default" : "outline"}
            >
              Encounters
            </Button>
            <Button
              size="sm"
              onClick={() => setFilterType("labs")}
              variant={filterType === "labs" ? "default" : "outline"}
            >
              Labs
            </Button>
          </div>

          {/* View Toggle */}
          <div className="flex items-center gap-2 bg-card/50 border border-border/50 rounded-lg p-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setViewMode("list")}
              className={`h-8 px-3 ${
                viewMode === "list"
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <List className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setViewMode("grid")}
              className={`h-8 px-3 ${
                viewMode === "grid"
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Grid3x3 className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Results Count */}
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {filteredRecords.length} of {textRecords.length} records
          </p>
          {(searchQuery || filterType !== "all") && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSearchQuery("");
                setFilterType("all");
              }}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              <X className="w-3 h-3 mr-1" />
              Clear filters
            </Button>
          )}
        </div>

        {/* Records List/Grid */}
        {filteredRecords.length === 0 ? (
          <div className="flex items-center justify-center py-16">
            <div className="text-center space-y-4">
              <div className="inline-flex p-6 rounded-full bg-muted/50">
                <FileText className="w-12 h-12 text-muted-foreground" />
              </div>
              <div>
                <h3 className="font-display text-xl font-semibold mb-2">No records found</h3>
                <p className="text-muted-foreground text-sm max-w-sm mx-auto">
                  {searchQuery || filterType !== "all"
                    ? "Try adjusting your search or filters"
                    : "No medical records available for this patient"}
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className={viewMode === "grid" ? "grid grid-cols-1 lg:grid-cols-2 gap-4" : "space-y-3"}>
            {filteredRecords.map((record) => (
              <MedicalRecordCard
                key={record.id}
                record={record}
                viewMode={viewMode}
                onClick={() => setSelectedRecord(record)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Detail Dialog */}
      <Dialog open={!!selectedRecord} onOpenChange={() => setSelectedRecord(null)}>
        <DialogContent className="max-w-7xl max-h-[90vh] p-0">
          <DialogHeader className="px-6 pt-6 pb-4 border-b border-border">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                {selectedRecord && getDetailIcon(selectedRecord)}
              </div>
              <div className="flex-1">
                <DialogTitle className="font-display text-xl">
                  {selectedRecord?.title || "Medical Record"}
                </DialogTitle>
                {selectedRecord && (
                  <p className="text-sm text-muted-foreground mt-1">
                    {new Date(selectedRecord.created_at).toLocaleDateString("en-US", {
                      weekday: "long",
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                  </p>
                )}
              </div>
            </div>
          </DialogHeader>

          <ScrollArea className="max-h-[calc(90vh-120px)] px-6 py-4">
            {selectedRecord?.content && (
              <ClinicalNoteViewer content={selectedRecord.content} />
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </>
  );
}
