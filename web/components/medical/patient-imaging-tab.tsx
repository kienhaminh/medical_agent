"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Scan,
  Calendar,
  Image as ImageIcon,
  Folder,
  Plus,
  ArrowLeft,
  Sparkles,
} from "lucide-react";
import { FilterableList } from "@/components/medical/filterable-list";
import type { Imaging, ImageGroup } from "@/lib/api";

interface PatientImagingTabProps {
  imageRecords: Imaging[];
  imageGroups?: ImageGroup[];
  setUploadOpen: (open: boolean) => void;
  setUploadDefaultGroupId?: (groupId: string | undefined) => void;
  setViewerRecord: (record: Imaging | null) => void;
  onAnalyzeGroup?: (payload: {
    groupId: string;
    groupName: string;
    images: Imaging[];
  }) => void;
}

export function PatientImagingTab({
  imageRecords,
  imageGroups = [],
  setUploadOpen,
  setUploadDefaultGroupId,
  setViewerRecord,
  onAnalyzeGroup,
}: PatientImagingTabProps) {
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);

  // Group images
  const groupedImages = imageRecords.reduce((acc, record) => {
    const groupId = record.group_id || "ungrouped";
    if (!acc[groupId]) acc[groupId] = [];
    acc[groupId].push(record);
    return acc;
  }, {} as Record<string | number, Imaging[]>);

  const ungroupedImages = groupedImages["ungrouped"] || [];

  const handleAddImageToGroup = (e: React.MouseEvent, groupId: string) => {
    e.stopPropagation();
    if (setUploadDefaultGroupId) {
      setUploadDefaultGroupId(groupId);
      setUploadOpen(true);
    }
  };

  // If a group is active, show its images
  if (activeGroupId) {
    const activeGroup = imageGroups.find(
      (g) => g.id.toString() === activeGroupId
    );
    const groupName =
      activeGroupId === "ungrouped"
        ? "Ungrouped Images"
        : activeGroup?.name || "Unknown Group";
    const groupImages = groupedImages[activeGroupId] || [];

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setActiveGroupId(null)}
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Groups
            </Button>
            <h2 className="font-display text-xl font-semibold">{groupName}</h2>
            <Badge variant="secondary">{groupImages.length} images</Badge>
          </div>
          <div className="flex items-center gap-2">
            {onAnalyzeGroup && groupImages.length > 0 && (
              <Button
                variant="secondary"
                onClick={() =>
                  onAnalyzeGroup({
                    groupId: activeGroupId,
                    groupName,
                    images: groupImages,
                  })
                }
                className="gap-2"
              >
                <Sparkles className="w-4 h-4" />
                Analyze Group
              </Button>
            )}
            <Button
              onClick={() => {
                if (activeGroupId !== "ungrouped" && setUploadDefaultGroupId) {
                  setUploadDefaultGroupId(activeGroupId);
                }
                setUploadOpen(true);
              }}
              className="primary-button"
            >
              <ImageIcon className="w-4 h-4 mr-2" />
              Add Image
            </Button>
          </div>
        </div>

        <ImagingList records={groupImages} setViewerRecord={setViewerRecord} />
      </div>
    );
  }

  // Otherwise, show the grid of groups
  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between mb-6">
        <h2 className="font-display text-xl font-semibold">Medical Imaging</h2>
        <Button onClick={() => setUploadOpen(true)} className="primary-button">
          <ImageIcon className="w-4 h-4 mr-2" />
          Upload Image
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Render Groups */}
        {imageGroups.map((group) => {
          const groupImages = groupedImages[group.id] || [];
          const latestImage =
            groupImages.length > 0
              ? groupImages.reduce((latest, current) =>
                  new Date(current.created_at) > new Date(latest.created_at)
                    ? current
                    : latest
                )
              : null;

          // Get unique image types in the group
          const uniqueTypes = [...new Set(groupImages.map(img => img.image_type).filter(Boolean))];
          const hasMultipleTypes = uniqueTypes.length > 1;

          return (
            <div
              key={group.id}
              className="group"
            >
              <Card
                className="cursor-pointer overflow-hidden border border-border/50 hover:border-cyan-500/60 transition-all duration-300 hover:shadow-lg hover:shadow-cyan-500/10"
                onClick={() => setActiveGroupId(group.id.toString())}
              >
                <div className="aspect-video bg-gradient-to-br from-muted/20 to-muted/10 relative overflow-hidden">
                  {latestImage ? (
                    <>
                      <img
                        src={latestImage.preview_url}
                        alt={group.name}
                        className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-all duration-500 group-hover:scale-105"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-80 group-hover:opacity-90 transition-opacity duration-300" />
                    </>
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-muted/30 to-muted/10">
                      <Folder className="w-16 h-16 text-muted-foreground/40 group-hover:text-muted-foreground/60 transition-colors" />
                      <span className="text-xs text-muted-foreground/50 mt-3 font-medium">
                        No images yet
                      </span>
                    </div>
                  )}

                  {/* Top right action button */}
                  <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-all duration-200">
                    <Button
                      size="sm"
                      variant="secondary"
                      className="h-8 bg-background/90 backdrop-blur-sm hover:bg-background shadow-md"
                      onClick={(e) => handleAddImageToGroup(e, group.id.toString())}
                    >
                      <Plus className="w-3.5 h-3.5 mr-1" />
                      Add
                    </Button>
                  </div>

                  {/* Bottom content overlay */}
                  <div className="absolute bottom-0 left-0 right-0 p-4">
                    <div className="space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="font-display font-semibold text-white text-lg leading-tight line-clamp-2 drop-shadow-sm">
                          {group.name}
                        </h3>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1.5">
                          <div className="p-1 rounded-md bg-white/20 backdrop-blur-sm">
                            <ImageIcon className="w-3.5 h-3.5 text-white" />
                          </div>
                          <span className="text-white/95 text-sm font-medium drop-shadow-sm">
                            {groupImages.length} {groupImages.length === 1 ? "image" : "images"}
                          </span>
                        </div>

                        {uniqueTypes.length > 0 && (
                          <div className="flex items-center gap-1">
                            {uniqueTypes.slice(0, 3).map((type) => (
                              <Badge
                                key={type}
                                variant="secondary"
                                className={`text-xs px-1.5 py-0.5 bg-white/20 backdrop-blur-sm text-white border-0 font-medium ${
                                  type === "mri" ? "medical-badge-mri" :
                                  type === "xray" ? "medical-badge-xray" :
                                                          "bg-white/20"
                                }`}
                              >
                                {type?.toUpperCase()}
                              </Badge>
                            ))}
                            {uniqueTypes.length > 3 && (
                              <Badge
                                variant="secondary"
                                className="text-xs px-1.5 py-0.5 bg-white/20 backdrop-blur-sm text-white border-0 font-medium"
                              >
                                +{uniqueTypes.length - 3}
                              </Badge>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Footer */}
                <div className="p-4 flex items-center justify-between bg-card/50 group-hover:bg-card/80 transition-colors border-t border-border/50">
                  <div className="text-xs text-muted-foreground/90 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5" />
                    <span className="font-medium">
                      {new Date(group.created_at).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: new Date(group.created_at).getFullYear() !== new Date().getFullYear() ? "numeric" : undefined
                      })}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Last updated indicator */}
                    {latestImage && new Date(latestImage.created_at) > new Date(group.created_at) && (
                      <div className="text-xs text-muted-foreground/70 flex items-center gap-1">
                        <Sparkles className="w-3 h-3 text-cyan-400" />
                        <span>Updated</span>
                      </div>
                    )}

                    {/* Image count indicator */}
                    <div className="text-xs font-medium text-muted-foreground/70">
                      {groupImages.length} total
                    </div>
                  </div>
                </div>
              </Card>

              {/* Quick stats row below card */}
              {groupImages.length > 0 && (
                <div className="mt-2 px-1">
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="flex items-center gap-2 text-muted-foreground/70">
                      <div className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                      <span className="truncate">
                        {uniqueTypes.length === 1 ? uniqueTypes[0]?.toUpperCase() : `${uniqueTypes.length} types`}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 justify-end text-muted-foreground/70">
                      <div className="w-1.5 h-1.5 rounded-full bg-purple-400" />
                      <span className="truncate">
                        {latestImage ? `Recent: ${new Date(latestImage.created_at).toLocaleDateString()}` : "Empty"}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {/* Ungrouped Images Card */}
        {ungroupedImages.length > 0 && (
          <Card
            className="group cursor-pointer overflow-hidden border-2 border-dashed border-border/60 hover:border-cyan-500/60 transition-all duration-300 hover:shadow-lg hover:shadow-cyan-500/10"
            onClick={() => setActiveGroupId("ungrouped")}
          >
            <div className="aspect-video bg-gradient-to-br from-orange-500/5 via-amber-500/5 to-yellow-500/5 relative flex items-center justify-center overflow-hidden">
              <div className="grid grid-cols-2 gap-1 p-4 w-full h-full opacity-80">
                {ungroupedImages.slice(0, 4).map((img, i) => (
                  <img
                    key={i}
                    src={img.preview_url}
                    className="w-full h-full object-cover rounded-md shadow-sm"
                    alt=""
                  />
                ))}
              </div>
              <div className="absolute inset-0 bg-gradient-to-t from-orange-500/80 via-orange-600/60 to-transparent opacity-90" />

              {/* Top right action button */}
              <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-all duration-200">
                <Button
                  size="sm"
                  variant="secondary"
                  className="h-8 bg-background/90 backdrop-blur-sm hover:bg-background shadow-md"
                  onClick={(e) => {
                    e.stopPropagation();
                    setUploadOpen(true);
                  }}
                >
                  <Plus className="w-3.5 h-3.5 mr-1" />
                  Add
                </Button>
              </div>

              {/* Center content */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center">
                  <div className="p-3 rounded-full bg-white/20 backdrop-blur-sm inline-flex mb-3">
                    <Folder className="w-8 h-8 text-white" />
                  </div>
                  <h3 className="font-display font-semibold text-white text-xl drop-shadow-sm">
                    Ungrouped Images
                  </h3>
                  <p className="text-white/90 text-sm mt-1 drop-shadow-sm">
                    {ungroupedImages.length} {ungroupedImages.length === 1 ? "image" : "images"}
                  </p>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 flex items-center justify-between bg-card/50 group-hover:bg-card/80 transition-colors border-t border-dashed border-border/60">
              <div className="text-xs text-muted-foreground/90 flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-orange-400 animate-pulse" />
                <span className="font-medium">
                  Needs organization
                </span>
              </div>

              <div className="text-xs font-medium text-muted-foreground/70">
                Click to view all
              </div>
            </div>
          </Card>
        )}
      </div>

      {imageRecords.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          No imaging records found
        </div>
      )}
    </div>
  );
}

function ImagingList({
  records,
  setViewerRecord,
}: {
  records: Imaging[];
  setViewerRecord: (r: Imaging) => void;
}) {
  return (
    <FilterableList
      items={records}
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
          compareFn: (a, b) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
        },
        {
          value: "oldest",
          label: "Oldest First",
          compareFn: (a, b) =>
            new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
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
                  record.image_type === "mri"
                    ? "medical-badge-mri"
                    : record.image_type === "xray"
                    ? "medical-badge-xray"
                    : "medical-badge-text"
                }
              >
                {record.image_type?.toUpperCase()}
              </Badge>
            </div>
            <h3 className="font-display font-semibold mb-2 group-hover:text-cyan-500 transition-colors">
              {record.title}
            </h3>
            <div className="relative w-full h-32 mb-3 bg-muted rounded-md overflow-hidden">
              <img
                src={record.preview_url}
                alt={record.title}
                className="w-full h-full object-cover"
              />
            </div>
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
                      record.image_type === "mri"
                        ? "medical-badge-mri"
                        : record.image_type === "xray"
                        ? "medical-badge-xray"
                        : "medical-badge-text"
                    }
                  >
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
