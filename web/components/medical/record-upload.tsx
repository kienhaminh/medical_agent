"use client";

import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload, FileImage, FileText, X, Loader2 } from "lucide-react";
import { uploadMedicalRecord } from "@/lib/api";
import type { MedicalRecord } from "@/lib/api";

interface RecordUploadProps {
  patientId: number;
  open: boolean;
  onClose: () => void;
  onUploadComplete: (record: MedicalRecord) => void;
}

export function RecordUpload({ patientId, open, onClose, onUploadComplete }: RecordUploadProps) {
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [fileType, setFileType] = useState<string>("other");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onDrop = useCallback((acceptedFiles: File[]) => {
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
  }, [title]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.png', '.jpg', '.jpeg', '.dicom'],
      'application/pdf': ['.pdf']
    },
    maxFiles: 1,
    maxSize: 50 * 1024 * 1024, // 50MB
  });

  const handleUpload = async () => {
    if (!file || !title.trim()) {
      setError("Please select a file and provide a title");
      return;
    }

    setUploading(true);
    setError(null);

    try {
      const response = await uploadMedicalRecord(patientId, file, {
        title: title.trim(),
        description: description.trim() || undefined,
        file_type: fileType,
      });

      onUploadComplete(response.record);
      handleClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to upload file");
    } finally {
      setUploading(false);
    }
  };

  const handleClose = () => {
    setFile(null);
    setTitle("");
    setDescription("");
    setFileType("other");
    setError(null);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">Upload Medical Record</DialogTitle>
          <DialogDescription>
            Upload images (MRI, X-Ray) or PDF lab reports
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
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
                    {isDragActive ? "Drop file here" : "Drag & drop file here"}
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
              disabled={uploading || !file || !title.trim()}
              className="primary-button"
            >
              {uploading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Uploading...
                </>
              ) : (
                "Upload Record"
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
