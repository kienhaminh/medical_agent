"use client";

import { useEffect, useState } from "react";
import { VisitListItem, VisitDetail, getVisit } from "@/lib/api";
import { IntakeDetail } from "./intake-detail";
import { ReviewDetail } from "./review-detail";
import { RoutedDetail } from "./routed-detail";
import { DepartmentDetail } from "./department-detail";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2 } from "lucide-react";
import { getColumnForStatus } from "./pipeline-constants";

interface DetailDialogProps {
  selectedVisit: VisitListItem | null;
  onClose: () => void;
  onVisitUpdated: () => void;
}

export function DetailDialog({
  selectedVisit,
  onClose,
  onVisitUpdated,
}: DetailDialogProps) {
  const [visitDetail, setVisitDetail] = useState<VisitDetail | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!selectedVisit) {
      setVisitDetail(null);
      return;
    }
    setLoading(true);
    getVisit(selectedVisit.id)
      .then(setVisitDetail)
      .catch(() => setVisitDetail(null))
      .finally(() => setLoading(false));
  }, [selectedVisit?.id, selectedVisit?.status]);

  const column = selectedVisit
    ? getColumnForStatus(selectedVisit.status)
    : null;

  const handleVisitUpdated = () => {
    onVisitUpdated();
    onClose();
  };

  const renderContent = () => {
    if (loading || !visitDetail) {
      return (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      );
    }

    const status = visitDetail.status;

    if (status === "intake" || status === "triaged") {
      return <IntakeDetail visit={visitDetail} />;
    }
    if (status === "auto_routed" || status === "pending_review") {
      return (
        <ReviewDetail visit={visitDetail} onVisitUpdated={handleVisitUpdated} />
      );
    }
    if (status === "routed") {
      return (
        <RoutedDetail visit={visitDetail} onVisitUpdated={handleVisitUpdated} />
      );
    }
    if (status === "in_department") {
      return (
        <DepartmentDetail
          visit={visitDetail}
          onVisitUpdated={handleVisitUpdated}
        />
      );
    }
    return (
      <p className="text-sm text-muted-foreground">
        Unknown visit status: {status}
      </p>
    );
  };

  return (
    <Dialog open={!!selectedVisit} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {column && (
              <div
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ backgroundColor: column.color }}
              />
            )}
            <span>{selectedVisit?.patient_name}</span>
            <span className="text-xs font-mono text-muted-foreground font-normal">
              {selectedVisit?.visit_id}
            </span>
          </DialogTitle>
        </DialogHeader>
        {renderContent()}
      </DialogContent>
    </Dialog>
  );
}
