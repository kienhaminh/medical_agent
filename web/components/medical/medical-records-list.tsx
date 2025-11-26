"use client";

import { useState } from "react";
import { MedicalRecord } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
  Calendar,
  Search,
  Filter,
  Grid3x3,
  List,
  Activity,
  Microscope,
  Stethoscope,
  FileHeart,
  X,
} from "lucide-react";
import { ClinicalNoteViewer } from "./clinical-note-viewer";

interface MedicalRecordsListProps {
  records: MedicalRecord[];
}

export function MedicalRecordsList({ records }: MedicalRecordsListProps) {
  const [selectedRecord, setSelectedRecord] = useState<MedicalRecord | null>(
    null
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("list");
  const [filterType, setFilterType] = useState<
    "all" | "registration" | "encounter" | "labs"
  >("all");

  // Filter text records only
  const textRecords = records.filter((r) => r.record_type === "text");

  // Apply filters
  const filteredRecords = textRecords.filter((record) => {
    // Search filter
    const matchesSearch =
      !searchQuery ||
      record.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      record.content?.toLowerCase().includes(searchQuery.toLowerCase());

    // Type filter
    const matchesType =
      filterType === "all" ||
      (filterType === "registration" &&
        record.title?.includes("Registration")) ||
      (filterType === "encounter" &&
        record.title?.includes("-") &&
        !record.title?.includes("Registration") &&
        !record.title?.includes("Routine")) ||
      (filterType === "labs" && record.title?.includes("Routine"));

    return matchesSearch && matchesType;
  });

  const getRecordIcon = (record: MedicalRecord) => {
    const summary = record.title?.toLowerCase() || "";

    if (summary.includes("registration")) {
      return <FileHeart className="w-5 h-5 text-purple-500" />;
    }
    if (summary.includes("routine") || summary.includes("laboratory")) {
      return <Microscope className="w-5 h-5 text-teal-500" />;
    }
    return <Stethoscope className="w-5 h-5 text-cyan-500" />;
  };

  const getRecordBadge = (record: MedicalRecord) => {
    const summary = record.title?.toLowerCase() || "";

    if (summary.includes("registration")) {
      return (
        <Badge
          variant="secondary"
          className="bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/30"
        >
          Registration
        </Badge>
      );
    }
    if (summary.includes("routine") || summary.includes("laboratory")) {
      return (
        <Badge
          variant="secondary"
          className="bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/30"
        >
          Lab Results
        </Badge>
      );
    }
    return (
      <Badge
        variant="secondary"
        className="bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/30"
      >
        Clinical Note
      </Badge>
    );
  };

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
              className="medical-input pl-10"
            />
          </div>

          <div className="flex items-center gap-2">
            {/* Filter Buttons */}
            <Button
              variant={filterType === "all" ? "default" : "outline"}
              size="sm"
              onClick={() => setFilterType("all")}
              className={
                filterType === "all" ? "primary-button" : "secondary-button"
              }
            >
              All
            </Button>
            <Button
              variant={filterType === "registration" ? "default" : "outline"}
              size="sm"
              onClick={() => setFilterType("registration")}
              className={
                filterType === "registration"
                  ? "primary-button"
                  : "secondary-button"
              }
            >
              Registration
            </Button>
            <Button
              variant={filterType === "encounter" ? "default" : "outline"}
              size="sm"
              onClick={() => setFilterType("encounter")}
              className={
                filterType === "encounter"
                  ? "primary-button"
                  : "secondary-button"
              }
            >
              Encounters
            </Button>
            <Button
              variant={filterType === "labs" ? "default" : "outline"}
              size="sm"
              onClick={() => setFilterType("labs")}
              className={
                filterType === "labs" ? "primary-button" : "secondary-button"
              }
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
                  ? "bg-gradient-to-r from-cyan-500/10 to-teal-500/10 text-cyan-500"
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
                  ? "bg-gradient-to-r from-cyan-500/10 to-teal-500/10 text-cyan-500"
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
                <h3 className="font-display text-xl font-semibold mb-2">
                  No records found
                </h3>
                <p className="text-muted-foreground text-sm max-w-sm mx-auto">
                  {searchQuery || filterType !== "all"
                    ? "Try adjusting your search or filters"
                    : "No medical records available for this patient"}
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div
            className={
              viewMode === "grid"
                ? "grid grid-cols-1 lg:grid-cols-2 gap-4"
                : "space-y-3"
            }
          >
            {filteredRecords.map((record) => (
              <button
                key={record.id}
                onClick={() => setSelectedRecord(record)}
                className="text-left w-full"
              >
                {viewMode === "grid" ? (
                  <Card className="record-card group p-5 h-full">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-lg bg-gradient-to-br from-cyan-500/10 to-teal-500/10 group-hover:scale-110 transition-transform">
                          {getRecordIcon(record)}
                        </div>
                        <div className="flex-1 min-w-0">
                          {getRecordBadge(record)}
                        </div>
                      </div>
                      <span className="text-xs text-muted-foreground flex-shrink-0">
                        {new Date(record.created_at).toLocaleDateString()}
                      </span>
                    </div>

                    <h3 className="font-display font-semibold mb-2 group-hover:text-cyan-500 transition-colors line-clamp-2">
                      {record.title || "Medical Record"}
                    </h3>

                    {record.content && (
                      <p className="text-sm text-muted-foreground line-clamp-3">
                        {record.content.substring(0, 200)}...
                      </p>
                    )}
                  </Card>
                ) : (
                  <Card className="record-card group p-4 hover:scale-[1.01] transition-all">
                    <div className="flex items-center gap-4">
                      <div className="p-2.5 rounded-lg bg-gradient-to-br from-cyan-500/10 to-teal-500/10 group-hover:scale-110 transition-transform flex-shrink-0">
                        {getRecordIcon(record)}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-display font-semibold truncate group-hover:text-cyan-500 transition-colors">
                            {record.title || "Medical Record"}
                          </h3>
                          {getRecordBadge(record)}
                        </div>

                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {new Date(record.created_at).toLocaleDateString(
                              "en-US",
                              {
                                year: "numeric",
                                month: "short",
                                day: "numeric",
                              }
                            )}
                          </span>
                          {record.content && (
                            <span className="truncate max-w-md">
                              {record.content.substring(0, 100)}...
                            </span>
                          )}
                        </div>
                      </div>

                      <Activity className="w-5 h-5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                    </div>
                  </Card>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Detail Dialog */}
      <Dialog
        open={!!selectedRecord}
        onOpenChange={() => setSelectedRecord(null)}
      >
        <DialogContent className="max-w-7xl max-h-[90vh] p-0">
          <DialogHeader className="px-6 pt-6 pb-4 border-b border-border">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-gradient-to-br from-cyan-500/10 to-teal-500/10">
                {selectedRecord && getRecordIcon(selectedRecord)}
              </div>
              <div className="flex-1">
                <DialogTitle className="font-display text-xl">
                  {selectedRecord?.title || "Medical Record"}
                </DialogTitle>
                {selectedRecord && (
                  <p className="text-sm text-muted-foreground mt-1">
                    {new Date(selectedRecord.created_at).toLocaleDateString(
                      "en-US",
                      {
                        weekday: "long",
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      }
                    )}
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
