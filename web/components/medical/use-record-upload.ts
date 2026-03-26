"use client";

import { useState, useEffect } from "react";
import { getImageGroups, createImageGroup } from "@/lib/api";
import type { MedicalRecord, Imaging, ImageGroup } from "@/lib/api";

const IMAGING_TYPES = ["xray", "t1", "t1ce", "t2", "flair", "mri", "ct_scan", "ultrasound"];

interface UseRecordUploadOptions {
  patientId: number;
  open: boolean;
  defaultGroupId?: string;
  onUploadComplete: (record: MedicalRecord | Imaging) => void;
  onGroupCreated?: (group: ImageGroup) => void;
  onClose: () => void;
}

export function useRecordUpload({
  patientId,
  open,
  defaultGroupId,
  onUploadComplete,
  onGroupCreated,
  onClose,
}: UseRecordUploadOptions) {
  const [previewUrl, setPreviewUrl] = useState("");
  const [originUrl, setOriginUrl] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [fileType, setFileType] = useState<string>("other");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Grouping state
  const [groups, setGroups] = useState<ImageGroup[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string>("none");
  const [newGroupName, setNewGroupName] = useState("");
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);
  const [isSavingGroup, setIsSavingGroup] = useState(false);

  // Fetch groups when dialog opens
  useEffect(() => {
    if (open) {
      getImageGroups(patientId)
        .then(setGroups)
        .catch((err) => {
          setError(err instanceof Error ? err.message : "Failed to fetch image groups");
        });
      setSelectedGroupId(defaultGroupId ?? "none");
    }
  }, [open, patientId, defaultGroupId]);

  const isImagingType = IMAGING_TYPES.includes(fileType);

  const handleUpload = async () => {
    if (!title.trim() || !previewUrl.trim() || !originUrl.trim()) {
      setError("Please provide a title, preview URL, and origin URL");
      return;
    }

    setUploading(true);
    setError(null);

    try {
      let record: MedicalRecord | Imaging;

      if (isImagingType) {
        const response = await fetch(`/api/patients/${patientId}/imaging`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: title.trim(),
            image_type: fileType,
            preview_url: previewUrl.trim(),
            original_url: originUrl.trim(),
            group_id:
              selectedGroupId !== "none" && selectedGroupId !== "new"
                ? parseInt(selectedGroupId)
                : undefined,
          }),
        });

        if (!response.ok) throw new Error("Failed to create imaging record");
        record = await response.json();
      } else {
        const response = await fetch(`/api/patients/${patientId}/records`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: title.trim(),
            description: description.trim() || undefined,
            file_type: fileType,
            preview_url: previewUrl.trim(),
            original_url: originUrl.trim(),
          }),
        });

        if (!response.ok) throw new Error("Failed to create medical record");
        record = await response.json();
      }

      onUploadComplete(record);
      handleClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add record");
    } finally {
      setUploading(false);
    }
  };

  const handleCreateGroup = async () => {
    if (!newGroupName.trim() || isSavingGroup) return;
    try {
      setIsSavingGroup(true);
      setError(null);
      const group = await createImageGroup(patientId, newGroupName.trim());
      setGroups((prev) => [group, ...prev]);
      setSelectedGroupId(group.id.toString());
      setNewGroupName("");
      setIsCreatingGroup(false);
      onGroupCreated?.(group);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create image group");
    } finally {
      setIsSavingGroup(false);
    }
  };

  const handleClose = () => {
    setPreviewUrl("");
    setOriginUrl("");
    setTitle("");
    setDescription("");
    setFileType("other");
    setError(null);
    setIsCreatingGroup(false);
    setIsSavingGroup(false);
    setSelectedGroupId("none");
    setNewGroupName("");
    onClose();
  };

  const handleGroupSelectChange = (val: string) => {
    if (val === "new") {
      setIsCreatingGroup(true);
      setSelectedGroupId("new");
    } else {
      setIsCreatingGroup(false);
      setSelectedGroupId(val);
    }
  };

  return {
    // Form state
    previewUrl, setPreviewUrl,
    originUrl, setOriginUrl,
    title, setTitle,
    description, setDescription,
    fileType, setFileType,
    uploading,
    error,
    // Group state
    groups,
    selectedGroupId,
    newGroupName, setNewGroupName,
    isCreatingGroup,
    isSavingGroup,
    isImagingType,
    // Handlers
    handleUpload,
    handleCreateGroup,
    handleClose,
    handleGroupSelectChange,
  };
}
