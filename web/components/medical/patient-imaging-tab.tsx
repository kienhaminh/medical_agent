"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Folder, Plus, ArrowLeft, Sparkles, Image as ImageIcon } from "lucide-react";
import { toast } from "sonner";
import { createImageGroup, type Imaging, type ImageGroup } from "@/lib/api";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { ImagingRecordsList } from "./imaging-records-list";
import { ImageGroupCard } from "./image-group-card";

interface PatientImagingTabProps {
  patientId: number;
  imageRecords: Imaging[];
  imageGroups?: ImageGroup[];
  setUploadOpen: (open: boolean) => void;
  setViewerRecord: (record: Imaging | null) => void;
  onAnalyzeGroup?: (payload: { groupId: string; groupName: string; images: Imaging[] }) => void;
}

export function PatientImagingTab({
  patientId,
  imageRecords,
  imageGroups = [],
  setUploadOpen,
  setViewerRecord,
  onAnalyzeGroup,
}: PatientImagingTabProps) {
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);
  const [createGroupOpen, setCreateGroupOpen] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);

  const handleCreateGroup = async () => {
    if (!newGroupName.trim()) return;
    setIsCreatingGroup(true);
    try {
      await createImageGroup(patientId, newGroupName);
      setCreateGroupOpen(false);
      setNewGroupName("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create image group");
    } finally {
      setIsCreatingGroup(false);
    }
  };

  // Group images by group id (Imaging type has no group_id field currently)
  const groupedImages: Record<string | number, Imaging[]> = {};

  // Active group view
  if (activeGroupId) {
    const activeGroup = imageGroups.find((g) => g.id.toString() === activeGroupId);
    const groupName = activeGroup?.name || "Unknown Group";
    const groupImages = groupedImages[activeGroupId] || [];

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={() => setActiveGroupId(null)}>
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
                onClick={() => onAnalyzeGroup({ groupId: activeGroupId, groupName, images: groupImages })}
                className="gap-2"
              >
                <Sparkles className="w-4 h-4" />
                Analyze Group
              </Button>
            )}
            <Button onClick={() => setUploadOpen(true)}>
              <ImageIcon className="w-4 h-4 mr-2" />
              Add Image
            </Button>
          </div>
        </div>

        <ImagingRecordsList records={groupImages} setViewerRecord={setViewerRecord} />
      </div>
    );
  }

  // Groups grid view
  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between mb-6">
        <h2 className="font-display text-xl font-semibold">Medical Imaging</h2>
        <Button onClick={() => setCreateGroupOpen(true)} variant="outline">
          <Folder className="w-4 h-4 mr-2" />
          Create Group
        </Button>
      </div>

      <Dialog open={createGroupOpen} onOpenChange={setCreateGroupOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Image Group</DialogTitle>
            <DialogDescription>Create a new group to organize medical images.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Group Name</Label>
              <Input
                id="name"
                placeholder="e.g., Brain MRI Series"
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleCreateGroup(); }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateGroupOpen(false)} disabled={isCreatingGroup}>
              Cancel
            </Button>
            <Button onClick={handleCreateGroup} disabled={isCreatingGroup || !newGroupName.trim()}>
              {isCreatingGroup && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Create Group
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {imageGroups.map((group) => (
          <ImageGroupCard
            key={group.id}
            group={group}
            groupImages={groupedImages[group.id] || []}
            onClick={() => setActiveGroupId(group.id.toString())}
          />
        ))}
      </div>

      {imageGroups.length === 0 && (
        <div className="text-center py-12 text-muted-foreground border-2 border-dashed border-border/50 rounded-lg">
          <div className="flex flex-col items-center justify-center space-y-3">
            <div className="p-3 rounded-full bg-muted/50 relative overflow-hidden group">
              <div className="absolute inset-0 bg-cyan-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <Folder className="w-8 h-8 text-muted-foreground/50 group-hover:text-cyan-500 transition-colors duration-300" />
            </div>
            <h3 className="text-lg font-semibold">No Image Groups</h3>
            <p className="text-sm text-muted-foreground max-w-sm">
              Create an image group to start organizing and uploading medical images.
            </p>
            <Button onClick={() => setCreateGroupOpen(true)} variant="outline" className="mt-4">
              <Plus className="w-4 h-4 mr-2" />
              Create First Group
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
