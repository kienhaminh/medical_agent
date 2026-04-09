"use client";

import { useState } from "react";
import { LogOut, ArrowRightLeft, FileCheck, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { DepartmentInfo } from "@/lib/api";

interface QuickActionsBarProps {
  onDischarge: () => void;
  onTransfer: (department: string) => void;
  onSaveNotes: () => void;
  departments: DepartmentInfo[];
  disabled?: boolean;
  onEndShift?: () => void;
}

export function QuickActionsBar({
  onDischarge,
  onTransfer,
  onSaveNotes,
  departments,
  disabled = false,
  onEndShift,
}: QuickActionsBarProps) {
  const [transferTarget, setTransferTarget] = useState<string>("");
  const [transferDialogOpen, setTransferDialogOpen] = useState(false);

  function handleTransferConfirm() {
    if (!transferTarget) return;
    onTransfer(transferTarget);
    setTransferTarget("");
    setTransferDialogOpen(false);
  }

  return (
    <div className="sticky bottom-0 z-20 border-t border-border bg-card/80 backdrop-blur-xl px-4 h-14 flex items-center">
      <div className="flex items-center justify-end gap-3 w-full">
        {/* Save Notes */}
        <Button
          variant="outline"
          size="sm"
          onClick={onSaveNotes}
          disabled={disabled}
          className="border-primary/30 hover:bg-primary/10 hover:text-primary"
        >
          <FileCheck className="w-4 h-4 mr-2" />
          Save Notes
        </Button>

        {/* Transfer */}
        <AlertDialog
          open={transferDialogOpen}
          onOpenChange={setTransferDialogOpen}
        >
          <AlertDialogTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              disabled={disabled}
              className="border-primary/30 hover:bg-primary/10 hover:text-primary"
            >
              <ArrowRightLeft className="w-4 h-4 mr-2" />
              Transfer
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent className="bg-card border-border">
            <AlertDialogHeader>
              <AlertDialogTitle>Transfer Patient</AlertDialogTitle>
              <AlertDialogDescription>
                Select the target department to transfer this patient.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="py-4">
              <Select value={transferTarget} onValueChange={setTransferTarget}>
                <SelectTrigger className="w-full bg-card/50 border-border/50">
                  <SelectValue placeholder="Select department..." />
                </SelectTrigger>
                <SelectContent>
                  {departments.map((dept) => (
                    <SelectItem key={dept.name} value={dept.name}>
                      {dept.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleTransferConfirm}
                disabled={!transferTarget}
                className="bg-primary hover:bg-primary/90 text-white"
              >
                Confirm Transfer
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Discharge */}
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              disabled={disabled}
              className="border-red-500/30 hover:bg-red-500/10 hover:text-red-400"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Discharge
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent className="bg-card border-border">
            <AlertDialogHeader>
              <AlertDialogTitle>Discharge Patient</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to discharge this patient? This will
                complete the current visit and remove them from the active queue.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={onDischarge}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                Confirm Discharge
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* End Shift */}
        {onEndShift && (
          <button
            onClick={onEndShift}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md border border-border text-muted-foreground hover:bg-accent transition-colors"
          >
            <FileText className="h-3.5 w-3.5" />
            End Shift
          </button>
        )}
      </div>
    </div>
  );
}
