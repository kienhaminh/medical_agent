// web/components/doctor/route-approval-dialog.tsx
"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";
import { routeVisit, type VisitDetail } from "@/lib/api";

const DEPARTMENTS = [
  { value: "general_checkup", label: "General Check-up" },
  { value: "cardiology", label: "Cardiology" },
  { value: "neurology", label: "Neurology" },
  { value: "orthopedics", label: "Orthopedics" },
  { value: "dermatology", label: "Dermatology" },
  { value: "gastroenterology", label: "Gastroenterology" },
  { value: "pulmonology", label: "Pulmonology" },
  { value: "endocrinology", label: "Endocrinology" },
  { value: "ophthalmology", label: "Ophthalmology" },
  { value: "ent", label: "ENT" },
  { value: "urology", label: "Urology" },
  { value: "radiology", label: "Radiology" },
  { value: "internal_medicine", label: "Internal Medicine" },
  { value: "emergency", label: "Emergency" },
];

interface RouteApprovalDialogProps {
  visit: VisitDetail | null;
  open: boolean;
  onClose: () => void;
  onRouted: () => void;
}

export function RouteApprovalDialog({
  visit,
  open,
  onClose,
  onRouted,
}: RouteApprovalDialogProps) {
  const [selected, setSelected] = useState<string[]>([]);
  const [reviewedBy, setReviewedBy] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize selected with current suggestion when visit changes
  const handleOpenChange = (isOpen: boolean) => {
    if (isOpen && visit?.routing_suggestion) {
      setSelected(visit.routing_suggestion);
    }
    if (!isOpen) onClose();
  };

  const toggleDepartment = (dept: string) => {
    setSelected((prev) =>
      prev.includes(dept) ? prev.filter((d) => d !== dept) : [...prev, dept]
    );
  };

  const handleSubmit = async () => {
    if (!visit || selected.length === 0 || !reviewedBy.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await routeVisit(visit.id, selected, reviewedBy.trim());
      onRouted();
      onClose();
      setSelected([]);
      setReviewedBy("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to route visit");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Route Visit</DialogTitle>
          <DialogDescription>
            {visit?.patient_name} — {visit?.visit_id}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {visit?.chief_complaint && (
            <div className="text-sm text-muted-foreground bg-muted/30 p-3 rounded-lg">
              {visit.chief_complaint}
            </div>
          )}

          <div className="space-y-2">
            <Label>Select department(s)</Label>
            <div className="flex flex-wrap gap-2">
              {DEPARTMENTS.map((dept) => (
                <Badge
                  key={dept.value}
                  variant="outline"
                  className={`cursor-pointer transition-colors ${
                    selected.includes(dept.value)
                      ? "bg-cyan-500/15 border-cyan-500 text-cyan-500"
                      : "hover:border-cyan-500/50"
                  }`}
                  onClick={() => toggleDepartment(dept.value)}
                >
                  {dept.label}
                </Badge>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="reviewedBy">Reviewed by</Label>
            <Input
              id="reviewedBy"
              placeholder="Dr. Smith"
              value={reviewedBy}
              onChange={(e) => setReviewedBy(e.target.value)}
              className="medical-input"
            />
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-500 text-sm">
              {error}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={saving || selected.length === 0 || !reviewedBy.trim()}
            className="primary-button"
          >
            {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Confirm Route
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
