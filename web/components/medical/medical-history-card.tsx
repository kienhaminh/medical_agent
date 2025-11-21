"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ChevronDown, ChevronUp, Edit, Save, X } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import type { PatientDetail } from "@/lib/api";

interface MedicalHistoryCardProps {
  patient: PatientDetail;
  onUpdate?: (updates: Partial<PatientDetail>) => void;
}

export function MedicalHistoryCard({ patient, onUpdate }: MedicalHistoryCardProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editedData, setEditedData] = useState({
    medical_history: patient.medical_history || "",
    allergies: patient.allergies || "",
    current_medications: patient.current_medications || "",
    family_history: patient.family_history || "",
  });

  const handleSave = () => {
    if (onUpdate) {
      onUpdate(editedData);
    }
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditedData({
      medical_history: patient.medical_history || "",
      allergies: patient.allergies || "",
      current_medications: patient.current_medications || "",
      family_history: patient.family_history || "",
    });
    setIsEditing(false);
  };

  return (
    <Card className="record-card">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-display text-xl font-semibold flex items-center gap-2">
          <div className="w-1 h-6 bg-cyan-500 rounded-full" />
          Medical History
        </h3>
        <div className="flex items-center gap-2">
          {!isEditing ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsEditing(true)}
              className="secondary-button"
            >
              <Edit className="w-4 h-4 mr-2" />
              Edit
            </Button>
          ) : (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={handleCancel}
                className="secondary-button"
              >
                <X className="w-4 h-4 mr-2" />
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleSave}
                className="primary-button"
              >
                <Save className="w-4 h-4 mr-2" />
                Save
              </Button>
            </>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </Button>
        </div>
      </div>

      {isExpanded && (
        <div className="space-y-6">
          {/* Medical History */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-teal-500 rounded-full" />
              <h4 className="font-display font-medium text-sm">General Medical History</h4>
            </div>
            {isEditing ? (
              <Textarea
                value={editedData.medical_history}
                onChange={(e) => setEditedData({ ...editedData, medical_history: e.target.value })}
                rows={4}
                className="medical-input text-sm"
                placeholder="Enter medical history..."
              />
            ) : (
              <p className="text-sm text-muted-foreground ml-4">
                {patient.medical_history || "No medical history recorded"}
              </p>
            )}
          </div>

          <Separator />

          {/* Allergies */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-red-500 rounded-full" />
              <h4 className="font-display font-medium text-sm">Allergies</h4>
            </div>
            {isEditing ? (
              <Textarea
                value={editedData.allergies}
                onChange={(e) => setEditedData({ ...editedData, allergies: e.target.value })}
                rows={2}
                className="medical-input text-sm"
                placeholder="Enter known allergies..."
              />
            ) : (
              <p className="text-sm text-muted-foreground ml-4">
                {patient.allergies || "No known allergies"}
              </p>
            )}
          </div>

          <Separator />

          {/* Current Medications */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-purple-500 rounded-full" />
              <h4 className="font-display font-medium text-sm">Current Medications</h4>
            </div>
            {isEditing ? (
              <Textarea
                value={editedData.current_medications}
                onChange={(e) => setEditedData({ ...editedData, current_medications: e.target.value })}
                rows={3}
                className="medical-input text-sm"
                placeholder="Enter current medications..."
              />
            ) : (
              <p className="text-sm text-muted-foreground ml-4">
                {patient.current_medications || "No current medications"}
              </p>
            )}
          </div>

          <Separator />

          {/* Family History */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-cyan-500 rounded-full" />
              <h4 className="font-display font-medium text-sm">Family History</h4>
            </div>
            {isEditing ? (
              <Textarea
                value={editedData.family_history}
                onChange={(e) => setEditedData({ ...editedData, family_history: e.target.value })}
                rows={3}
                className="medical-input text-sm"
                placeholder="Enter family medical history..."
              />
            ) : (
              <p className="text-sm text-muted-foreground ml-4">
                {patient.family_history || "No family history recorded"}
              </p>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}
