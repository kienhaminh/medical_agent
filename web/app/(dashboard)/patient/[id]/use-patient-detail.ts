"use client";

import { useEffect, useState } from "react";
import {
  getPatient,
  getImageGroups,
  deleteImagingRecord,
  type MedicalRecord,
  type Imaging,
  type ImageGroup,
} from "@/lib/api";
import { getMockPatientById, type PatientWithDetails } from "@/lib/mock-data";
import { toast } from "sonner";
import { usePatientChat } from "./use-patient-chat";

export function usePatientDetail(patientId: number, sessionId: string | null) {
  const [patient, setPatient] = useState<PatientWithDetails | null>(null);
  const [activeTab, setActiveTab] = useState("overview");
  const [aiOpen, setAiOpen] = useState(!!sessionId);
  const [aiWidth, setAiWidth] = useState(400);
  const [isResizing, setIsResizing] = useState(false);

  const [uploadOpen, setUploadOpen] = useState(false);
  const [viewerRecord, setViewerRecord] = useState<MedicalRecord | Imaging | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Imaging | null>(null);
  const [isDeletingImaging, setIsDeletingImaging] = useState(false);

  const chat = usePatientChat(sessionId, patient?.id ?? null);

  useEffect(() => {
    if (!patientId) return;
    Promise.all([getPatient(patientId), getImageGroups(patientId)])
      .then(([patientData, imageGroupsData]) => {
        setPatient({ ...patientData, image_groups: imageGroupsData });
      })
      .catch(() => {
        const mockPatient = getMockPatientById(patientId);
        if (mockPatient) setPatient(mockPatient);
      });
  }, [patientId]);

  const handleUploadComplete = (record: MedicalRecord | Imaging) => {
    setPatient((current) => {
      if (!current) return current;
      if ("image_type" in record) {
        return { ...current, imaging: [record as Imaging, ...(current.imaging || [])] };
      }
      return { ...current, records: [record as MedicalRecord, ...(current.records || [])] };
    });
  };

  const handleImageGroupCreated = (group: ImageGroup) => {
    setPatient((current) => {
      if (!current) return current;
      const existingGroups = current.image_groups || [];
      if (existingGroups.some((g) => g.id === group.id)) return current;
      return { ...current, image_groups: [group, ...existingGroups] };
    });
  };

  const handleDeleteImaging = (record: Imaging) => {
    setPendingDelete(record);
    setDeleteDialogOpen(true);
  };

  const confirmDeleteImaging = async () => {
    if (!patient || !pendingDelete) return;
    setIsDeletingImaging(true);
    try {
      await deleteImagingRecord(patient.id, pendingDelete.id);
      setPatient({
        ...patient,
        imaging: (patient.imaging || []).filter((img) => img.id !== pendingDelete.id),
      });
      setViewerRecord((current) =>
        current && "image_type" in current && current.id === pendingDelete.id ? null : current
      );
      setDeleteDialogOpen(false);
      setPendingDelete(null);
    } catch {
      toast.error("Failed to delete imaging record");
    } finally {
      setIsDeletingImaging(false);
    }
  };

  const handleAnalyzeGroup = ({ groupName, images }: { groupName: string; images: Imaging[] }) => {
    if (!images.length || !patient) return;
    setAiOpen(true);
    const summaryList = images.slice(0, 5).map((img) => `${img.title} (${img.image_type})`).join(", ");
    const moreIndicator = images.length > 5 ? "..." : "";
    const message = `Patient: ${patient.name} (ID: ${patient.id})\n\nAnalyze the imaging group "${groupName}" containing ${images.length} images: ${summaryList}${moreIndicator}`;
    chat.sendMessage(message);
  };

  return {
    patient,
    activeTab, setActiveTab,
    aiOpen, setAiOpen,
    aiWidth, setAiWidth,
    isResizing, setIsResizing,
    uploadOpen, setUploadOpen,
    viewerRecord, setViewerRecord,
    deleteDialogOpen, setDeleteDialogOpen,
    pendingDelete,
    isDeletingImaging,
    chat,
    handleUploadComplete,
    handleImageGroupCreated,
    handleDeleteImaging,
    confirmDeleteImaging,
    handleAnalyzeGroup,
  };
}
