"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { PatientVisit, MedicalRecord } from "@/lib/api";
import {
  Calendar,
  User,
  Activity,
  FileText,
  Heart,
  Thermometer,
  Weight,
  Ruler,
  Wind,
  Droplets,
  Stethoscope,
  Image as ImageIcon,
  File,
} from "lucide-react";
import ReactMarkdown from "react-markdown";

interface VisitDetailViewerProps {
  visit: PatientVisit | null;
  records?: MedicalRecord[];
  open: boolean;
  onClose: () => void;
  onRecordClick?: (record: MedicalRecord) => void;
}

const visitTypeColors = {
  routine: "medical-badge-text",
  emergency: "bg-red-500/10 text-red-500 border-red-500/30",
  "follow-up": "medical-badge-mri",
  consultation: "medical-badge-xray",
};

const statusColors = {
  scheduled: "bg-blue-500/10 text-blue-500 border-blue-500/30",
  "in-progress": "bg-yellow-500/10 text-yellow-500 border-yellow-500/30",
  completed: "bg-green-500/10 text-green-500 border-green-500/30",
  cancelled: "bg-gray-500/10 text-gray-500 border-gray-500/30",
};

export function VisitDetailViewer({
  visit,
  records = [],
  open,
  onClose,
  onRecordClick,
}: VisitDetailViewerProps) {
  if (!visit) return null;

  const visitRecords = records.filter((r) => r.visit_id === visit.id);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <DialogTitle className="font-display text-2xl mb-2">
                {visit.visit_type.charAt(0).toUpperCase() + visit.visit_type.slice(1)} Visit
              </DialogTitle>
              <div className="flex items-center gap-3 flex-wrap">
                <Badge variant="secondary" className={visitTypeColors[visit.visit_type as keyof typeof visitTypeColors] || "medical-badge-text"}>
                  {visit.visit_type}
                </Badge>
                <Badge variant="secondary" className={statusColors[visit.status as keyof typeof statusColors]}>
                  {visit.status}
                </Badge>
                <span className="text-sm text-muted-foreground flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5" />
                  {new Date(visit.visit_date).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
                <span className="text-sm text-muted-foreground flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5" />
                  {visit.doctor_name}
                </span>
              </div>
            </div>
          </div>
        </DialogHeader>

        <ScrollArea className="max-h-[calc(90vh-120px)] pr-4">
          <div className="space-y-6 mt-4">
            {/* Chief Complaint */}
            <Card className="p-4 bg-gradient-to-r from-cyan-500/5 to-teal-500/5 border-cyan-500/20">
              <h3 className="font-display font-semibold text-sm text-cyan-500 mb-2 flex items-center gap-2">
                <Activity className="w-4 h-4" />
                Chief Complaint
              </h3>
              <p className="text-sm leading-relaxed">{visit.chief_complaint}</p>
            </Card>

            {/* Vital Signs */}
            {visit.vital_signs && (
              <Card className="p-4 bg-card/50 border-border/50">
                <h3 className="font-display font-semibold mb-4 flex items-center gap-2">
                  <Stethoscope className="w-4 h-4 text-cyan-500" />
                  Vital Signs
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {visit.vital_signs.temperature && (
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Thermometer className="w-3.5 h-3.5" />
                        Temperature
                      </div>
                      <p className="text-sm font-medium">{visit.vital_signs.temperature}</p>
                    </div>
                  )}
                  {visit.vital_signs.blood_pressure && (
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Heart className="w-3.5 h-3.5" />
                        Blood Pressure
                      </div>
                      <p className="text-sm font-medium">{visit.vital_signs.blood_pressure}</p>
                    </div>
                  )}
                  {visit.vital_signs.heart_rate && (
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Activity className="w-3.5 h-3.5" />
                        Heart Rate
                      </div>
                      <p className="text-sm font-medium">{visit.vital_signs.heart_rate}</p>
                    </div>
                  )}
                  {visit.vital_signs.respiratory_rate && (
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Wind className="w-3.5 h-3.5" />
                        Respiratory Rate
                      </div>
                      <p className="text-sm font-medium">{visit.vital_signs.respiratory_rate}</p>
                    </div>
                  )}
                  {visit.vital_signs.oxygen_saturation && (
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Droplets className="w-3.5 h-3.5" />
                        O₂ Saturation
                      </div>
                      <p className="text-sm font-medium">{visit.vital_signs.oxygen_saturation}</p>
                    </div>
                  )}
                  {visit.vital_signs.weight && (
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Weight className="w-3.5 h-3.5" />
                        Weight
                      </div>
                      <p className="text-sm font-medium">{visit.vital_signs.weight}</p>
                    </div>
                  )}
                  {visit.vital_signs.height && (
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Ruler className="w-3.5 h-3.5" />
                        Height
                      </div>
                      <p className="text-sm font-medium">{visit.vital_signs.height}</p>
                    </div>
                  )}
                </div>
              </Card>
            )}

            {/* Diagnosis */}
            <div className="space-y-2">
              <h3 className="font-display font-semibold text-sm text-muted-foreground">Diagnosis</h3>
              <Card className="p-4 bg-card/50 border-border/50">
                <p className="text-sm leading-relaxed">{visit.diagnosis}</p>
              </Card>
            </div>

            {/* Treatment Plan */}
            <div className="space-y-2">
              <h3 className="font-display font-semibold text-sm text-muted-foreground">Treatment Plan</h3>
              <Card className="p-4 bg-card/50 border-border/50">
                <p className="text-sm leading-relaxed">{visit.treatment_plan}</p>
              </Card>
            </div>

            {/* Clinical Notes */}
            <div className="space-y-2">
              <h3 className="font-display font-semibold text-sm text-muted-foreground flex items-center gap-2">
                <FileText className="w-4 h-4" />
                Clinical Notes
              </h3>
              <Card className="p-4 bg-card/50 border-border/50">
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  <ReactMarkdown className="text-sm leading-relaxed whitespace-pre-wrap">
                    {visit.notes}
                  </ReactMarkdown>
                </div>
              </Card>
            </div>

            {/* Attached Records */}
            {visitRecords.length > 0 && (
              <div className="space-y-3">
                <Separator />
                <h3 className="font-display font-semibold text-sm text-muted-foreground">
                  Attached Records ({visitRecords.length})
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {visitRecords.map((record) => (
                    <button
                      key={record.id}
                      onClick={() => onRecordClick?.(record)}
                      className="text-left"
                    >
                      <Card className="p-3 hover:bg-cyan-500/5 transition-colors group border-border/50">
                        <div className="flex items-start gap-3">
                          <div className="p-2 rounded-lg bg-cyan-500/10 group-hover:bg-cyan-500/20 transition-colors flex-shrink-0">
                            {record.record_type === "image" ? (
                              <ImageIcon className="w-4 h-4 text-cyan-500" />
                            ) : record.record_type === "pdf" ? (
                              <File className="w-4 h-4 text-cyan-500" />
                            ) : (
                              <FileText className="w-4 h-4 text-cyan-500" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="font-medium text-sm truncate group-hover:text-cyan-500 transition-colors">
                              {record.title}
                            </h4>
                            {record.description && (
                              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                                {record.description}
                              </p>
                            )}
                            <div className="flex items-center gap-2 mt-1">
                              <Badge variant="secondary" className="text-xs">
                                {record.file_type || record.record_type}
                              </Badge>
                              <span className="text-xs text-muted-foreground">
                                {new Date(record.created_at).toLocaleDateString()}
                              </span>
                            </div>
                          </div>
                        </div>
                      </Card>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
