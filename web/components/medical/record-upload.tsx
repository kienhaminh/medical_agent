"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import type { MedicalRecord, Imaging, ImageGroup } from "@/lib/api";
import { useRecordUpload } from "./use-record-upload";

interface RecordUploadProps {
  patientId: number;
  open: boolean;
  onClose: () => void;
  onUploadComplete: (record: MedicalRecord | Imaging) => void;
  defaultGroupId?: string;
  onGroupCreated?: (group: ImageGroup) => void;
}

export function RecordUpload({
  patientId,
  open,
  onClose,
  onUploadComplete,
  defaultGroupId,
  onGroupCreated,
}: RecordUploadProps) {
  const {
    previewUrl, setPreviewUrl,
    originUrl, setOriginUrl,
    title, setTitle,
    description, setDescription,
    fileType, setFileType,
    uploading,
    error,
    groups,
    selectedGroupId,
    newGroupName, setNewGroupName,
    isCreatingGroup,
    isSavingGroup,
    isImagingType,
    handleUpload,
    handleCreateGroup,
    handleClose,
    handleGroupSelectChange,
  } = useRecordUpload({ patientId, open, defaultGroupId, onUploadComplete, onGroupCreated, onClose });

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">
            Add Medical Image
          </DialogTitle>
          <DialogDescription>
            Add imaging records via URL (MRI, X-Ray, CT Scan, etc.)
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* URL Input Area */}
          <div className="space-y-2">
            <Label htmlFor="previewUrl">Preview URL *</Label>
            <Input
              id="previewUrl"
              type="url"
              value={previewUrl}
              onChange={(e) => setPreviewUrl(e.target.value)}
              placeholder="https://example.com/image-preview.jpg"
            />
            <p className="text-xs text-muted-foreground">
              URL to the preview/thumbnail image
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="originUrl">Origin URL *</Label>
            <Input
              id="originUrl"
              type="url"
              value={originUrl}
              onChange={(e) => setOriginUrl(e.target.value)}
              placeholder="https://example.com/full-resolution-image.jpg"
            />
            <p className="text-xs text-muted-foreground">
              URL to the original/full resolution image
            </p>
          </div>

          {previewUrl && (
            <div className="mt-4 p-4 rounded-lg bg-background border border-border">
              <p className="text-sm font-medium text-muted-foreground mb-2">
                Preview:
              </p>
              <img
                src={previewUrl}
                alt="Preview"
                className="max-w-full max-h-48 rounded-lg object-contain mx-auto"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = "none";
                }}
              />
            </div>
          )}

          {/* Metadata Form */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">Title *</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Brain MRI Scan"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="fileType">File Type</Label>
              <Select value={fileType} onValueChange={setFileType}>
                <SelectTrigger id="fileType">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="mri">MRI Scan</SelectItem>
                  <SelectItem value="xray">X-Ray</SelectItem>
                  <SelectItem value="t1">T1</SelectItem>
                  <SelectItem value="t1ce">T1CE</SelectItem>
                  <SelectItem value="t2">T2</SelectItem>
                  <SelectItem value="flair">FLAIR</SelectItem>
                  <SelectItem value="ct_scan">CT Scan</SelectItem>
                  <SelectItem value="ultrasound">Ultrasound</SelectItem>
                  <SelectItem value="lab_report">Lab Report</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description (Optional)</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Additional notes about this record..."
                rows={3}
              />
            </div>

            {/* Image Group Selection (only for imaging types) */}
            {isImagingType && (
              <div className="space-y-2">
                <Label htmlFor="group">Image Group (Optional)</Label>
                <div className="flex gap-2">
                  <Select value={selectedGroupId} onValueChange={handleGroupSelectChange}>
                    <SelectTrigger id="group" className="flex-1">
                      <SelectValue placeholder="Select a group..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No Group</SelectItem>
                      {groups.map((g) => (
                        <SelectItem key={g.id} value={g.id.toString()}>
                          {g.name}
                        </SelectItem>
                      ))}
                      <SelectItem value="new" className="text-primary font-medium">
                        + Create New Group
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {isCreatingGroup && (
                  <div className="flex gap-2 mt-2 animate-in fade-in slide-in-from-top-2">
                    <Input
                      placeholder="Enter group name..."
                      value={newGroupName}
                      onChange={(e) => setNewGroupName(e.target.value)}
                    />
                    <Button
                      type="button"
                      onClick={handleCreateGroup}
                      disabled={!newGroupName.trim() || isSavingGroup}
                      className="whitespace-nowrap"
                    >
                      {isSavingGroup ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Creating...
                        </>
                      ) : (
                        "Create"
                      )}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => {
                        handleGroupSelectChange("none");
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Error Message */}
          {error && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-500 text-sm">
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 justify-end">
            <Button variant="outline" onClick={handleClose} disabled={uploading}>
              Cancel
            </Button>
            <Button
              onClick={handleUpload}
              disabled={uploading || !title.trim() || !previewUrl.trim() || !originUrl.trim()}
            >
              {uploading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Adding...
                </>
              ) : (
                "Add Record"
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
