import { useState, useCallback, useEffect } from "react";
import { useDropzone } from "react-dropzone";
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
import { Upload, FileImage, FileText, X, Loader2, Link2 } from "lucide-react";
import {
  uploadMedicalRecord,
  uploadImagingRecord,
  getImageGroups,
  createImageGroup,
} from "@/lib/api";
import type { MedicalRecord, Imaging, ImageGroup } from "@/lib/api";

interface RecordUploadProps {
  patientId: number;
  open: boolean;
  onClose: () => void;
  onUploadComplete: (record: MedicalRecord | Imaging) => void;
  defaultGroupId?: string;
  onGroupCreated?: (group: ImageGroup) => void;
}

type UploadMode = "file" | "url";

export function RecordUpload({
  patientId,
  open,
  onClose,
  onUploadComplete,
  defaultGroupId,
  onGroupCreated,
}: RecordUploadProps) {
  const [uploadMode, setUploadMode] = useState<UploadMode>("file");
  const [file, setFile] = useState<File | null>(null);
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
          console.error(err);
          setError(
            err instanceof Error ? err.message : "Failed to fetch image groups"
          );
        });
      if (defaultGroupId) {
        setSelectedGroupId(defaultGroupId);
      } else {
        setSelectedGroupId("none");
      }
    }
  }, [open, patientId, defaultGroupId]);

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      if (acceptedFiles.length > 0) {
        const uploadedFile = acceptedFiles[0];
        setFile(uploadedFile);
        setError(null);

        // Auto-detect file type
        if (uploadedFile.type.startsWith("image/")) {
          if (!title) setTitle(`Medical Image - ${uploadedFile.name}`);
        } else if (uploadedFile.type === "application/pdf") {
          setFileType("lab_report");
          if (!title) setTitle(`Lab Report - ${uploadedFile.name}`);
        }
      }
    },
    [title]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "image/*": [".png", ".jpg", ".jpeg", ".dicom"],
      "application/pdf": [".pdf"],
    },
    maxFiles: 1,
    maxSize: 50 * 1024 * 1024, // 50MB
  });

  const handleUpload = async () => {
    // Validate based on upload mode
    if (uploadMode === "file") {
      if (!file || !title.trim()) {
        setError("Please select a file and provide a title");
        return;
      }
    } else {
      if (!title.trim() || !previewUrl.trim() || !originUrl.trim()) {
        setError("Please provide a title, preview URL, and origin URL");
        return;
      }
    }

    setUploading(true);
    setError(null);

    try {
      let record: MedicalRecord | Imaging;

      const imagingTypes = [
        "xray",
        "t1",
        "t1ce",
        "t2",
        "flair",
        "mri",
        "ct_scan",
        "ultrasound",
      ];

      if (uploadMode === "url") {
        // For URL-based upload
        if (imagingTypes.includes(fileType)) {
          // Create imaging record with URLs
          const response = await fetch(`/api/patients/${patientId}/imaging`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              title: title.trim(),
              image_type: fileType,
              preview_url: previewUrl.trim(),
              origin_url: originUrl.trim(),
              group_id:
                selectedGroupId !== "none" && selectedGroupId !== "new"
                  ? parseInt(selectedGroupId)
                  : undefined,
            }),
          });

          if (!response.ok) {
            throw new Error("Failed to create imaging record");
          }

          record = await response.json();
        } else {
          // Create medical record with URLs
          const response = await fetch(`/api/patients/${patientId}/records`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              title: title.trim(),
              description: description.trim() || undefined,
              file_type: fileType,
              preview_url: previewUrl.trim(),
              origin_url: originUrl.trim(),
            }),
          });

          if (!response.ok) {
            throw new Error("Failed to create medical record");
          }

          const data = await response.json();
          record = data.record;
        }
      } else {
        // Original file upload logic
        if (imagingTypes.includes(fileType)) {
          record = await uploadImagingRecord(patientId, file!, {
            title: title.trim(),
            image_type: fileType,
            group_id:
              selectedGroupId !== "none" && selectedGroupId !== "new"
                ? parseInt(selectedGroupId)
                : undefined,
          });
        } else {
          const response = await uploadMedicalRecord(patientId, file!, {
            title: title.trim(),
            description: description.trim() || undefined,
            file_type: fileType,
          });
          record = response.record;
        }
      }

      onUploadComplete(record);
      handleClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to upload file");
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
      console.error("Failed to create group:", err);
      setError(
        err instanceof Error ? err.message : "Failed to create image group"
      );
    } finally {
      setIsSavingGroup(false);
    }
  };

  const handleClose = () => {
    setUploadMode("file");
    setFile(null);
    setPreviewUrl("");
    setOriginUrl("");
    setTitle("");
    setDescription("");
    setFileType("other");
    setError(null);
    setIsCreatingGroup(false);
    setIsSavingGroup(false);
    // Don't reset selectedGroupId here if we want it to persist, but usually we do.
    // However, if defaultGroupId is passed, it might be confusing.
    // Let's reset to "none" or default if we had one, but for now "none" is safe as the dialog unmounts or resets on open.
    setSelectedGroupId("none");
    setNewGroupName("");
    setIsCreatingGroup(false);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">
            Upload Medical Image
          </DialogTitle>
          <DialogDescription>
            Upload images (MRI, X-Ray, CT Scan, etc.)
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Upload Mode Toggle */}
          <div className="flex gap-2 p-1 bg-muted rounded-lg">
            <Button
              type="button"
              variant={uploadMode === "file" ? "default" : "ghost"}
              className={`flex-1 ${
                uploadMode === "file"
                  ? "primary-button"
                  : "hover:bg-background/50"
              }`}
              onClick={() => setUploadMode("file")}
            >
              <Upload className="w-4 h-4 mr-2" />
              Upload File
            </Button>
            <Button
              type="button"
              variant={uploadMode === "url" ? "default" : "ghost"}
              className={`flex-1 ${
                uploadMode === "url"
                  ? "primary-button"
                  : "hover:bg-background/50"
              }`}
              onClick={() => setUploadMode("url")}
            >
              <Link2 className="w-4 h-4 mr-2" />
              Add by URL
            </Button>
          </div>

          {uploadMode === "file" ? (
            <>
              {/* File Upload Area */}
              <div
                {...getRootProps()}
                className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
                  isDragActive
                    ? "border-cyan-500 bg-cyan-500/5 medical-border-glow"
                    : "border-border hover:border-cyan-500/50"
                }`}
              >
                <input {...getInputProps()} />

                {file ? (
                  <div className="space-y-4">
                    <div className="inline-flex p-3 rounded-xl bg-cyan-500/10">
                      {file.type.startsWith("image/") ? (
                        <FileImage className="w-8 h-8 text-cyan-500" />
                      ) : (
                        <FileText className="w-8 h-8 text-cyan-500" />
                      )}
                    </div>
                    <div>
                      <p className="font-medium text-foreground">{file.name}</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        {(file.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        setFile(null);
                      }}
                      className="secondary-button"
                    >
                      <X className="w-4 h-4 mr-2" />
                      Remove
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="inline-flex p-4 rounded-xl bg-cyan-500/10">
                      <Upload className="w-10 h-10 text-cyan-500" />
                    </div>
                    <div>
                      <p className="font-medium text-foreground">
                        {isDragActive
                          ? "Drop file here"
                          : "Drag & drop file here"}
                      </p>
                      <p className="text-sm text-muted-foreground mt-2">
                        or click to browse (max 50MB)
                      </p>
                      <p className="text-xs text-muted-foreground mt-2">
                        Supported: JPG, PNG, DICOM, PDF
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              {/* URL Input Area */}
              <div className="space-y-2">
                <Label htmlFor="previewUrl">Preview URL *</Label>
                <Input
                  id="previewUrl"
                  type="url"
                  value={previewUrl}
                  onChange={(e) => setPreviewUrl(e.target.value)}
                  placeholder="https://example.com/image-preview.jpg"
                  className="medical-input"
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
                  className="medical-input"
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
            </>
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
                className="medical-input"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="fileType">File Type</Label>
              <Select value={fileType} onValueChange={setFileType}>
                <SelectTrigger id="fileType" className="medical-input">
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
                className="medical-input"
              />
            </div>

            {/* Image Group Selection (Only for imaging types) */}
            {[
              "xray",
              "mri",
              "ct_scan",
              "ultrasound",
              "t1",
              "t1ce",
              "t2",
              "flair",
            ].includes(fileType) && (
              <div className="space-y-2">
                <Label htmlFor="group">Image Group (Optional)</Label>
                <div className="flex gap-2">
                  <Select
                    value={selectedGroupId}
                    onValueChange={(val) => {
                      if (val === "new") {
                        setIsCreatingGroup(true);
                        setSelectedGroupId("new");
                      } else {
                        setIsCreatingGroup(false);
                        setSelectedGroupId(val);
                      }
                    }}
                  >
                    <SelectTrigger id="group" className="medical-input flex-1">
                      <SelectValue placeholder="Select a group..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No Group</SelectItem>
                      {groups.map((g) => (
                        <SelectItem key={g.id} value={g.id.toString()}>
                          {g.name}
                        </SelectItem>
                      ))}
                      <SelectItem
                        value="new"
                        className="text-cyan-500 font-medium"
                      >
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
                      className="medical-input"
                    />
                    <Button
                      type="button"
                      onClick={handleCreateGroup}
                      disabled={!newGroupName.trim() || isSavingGroup}
                      className="primary-button whitespace-nowrap"
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
                        setIsCreatingGroup(false);
                        setSelectedGroupId("none");
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
            <Button
              variant="outline"
              onClick={handleClose}
              disabled={uploading}
              className="secondary-button"
            >
              Cancel
            </Button>
            <Button
              onClick={handleUpload}
              disabled={
                uploading ||
                !title.trim() ||
                (uploadMode === "file"
                  ? !file
                  : !previewUrl.trim() || !originUrl.trim())
              }
              className="primary-button"
            >
              {uploading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {uploadMode === "file" ? "Uploading..." : "Adding..."}
                </>
              ) : uploadMode === "file" ? (
                "Upload Record"
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
