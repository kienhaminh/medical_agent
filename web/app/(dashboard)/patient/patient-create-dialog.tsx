"use client";

import { useState } from "react";
import { createPatient } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Plus } from "lucide-react";

interface PatientCreateDialogProps {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}

export function PatientCreateDialog({ open, onClose, onCreated }: PatientCreateDialogProps) {
  const [newPatient, setNewPatient] = useState({ name: "", dob: "", gender: "" });
  const [createError, setCreateError] = useState<string | null>(null);

  const handleClose = () => {
    setCreateError(null);
    onClose();
  };

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreateError(null);
    try {
      await createPatient(newPatient);
      setNewPatient({ name: "", dob: "", gender: "" });
      onCreated();
      onClose();
    } catch (error) {
      setCreateError(error instanceof Error ? error.message : "Failed to create patient");
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); }}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">Add New Patient</DialogTitle>
          <DialogDescription>
            Enter patient information to create a new medical record
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleCreate} className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label htmlFor="name">Full Name *</Label>
            <Input
              id="name"
              type="text"
              required
              value={newPatient.name}
              onChange={(e) => setNewPatient({ ...newPatient, name: e.target.value })}
              placeholder="John Doe"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="dob">Date of Birth *</Label>
            <Input
              id="dob"
              type="date"
              required
              value={newPatient.dob}
              onChange={(e) => setNewPatient({ ...newPatient, dob: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="gender">Gender *</Label>
            <Select
              value={newPatient.gender}
              onValueChange={(value) => setNewPatient({ ...newPatient, gender: value })}
            >
              <SelectTrigger id="gender">
                <SelectValue placeholder="Select gender" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Male">Male</SelectItem>
                <SelectItem value="Female">Female</SelectItem>
                <SelectItem value="Other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {createError && <p className="text-sm text-red-500">{createError}</p>}

          <div className="flex gap-3 justify-end pt-4">
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button type="submit">
              <Plus className="w-4 h-4 mr-2" />
              Create Patient
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
