"use client";

import { useEffect, useState } from "react";
import { VisitListItem, VisitDetail, getVisit } from "@/lib/api";
import { IntakeDetail } from "./intake-detail";
import { ReviewDetail } from "./review-detail";
import { RoutedDetail } from "./routed-detail";
import { DepartmentDetail } from "./department-detail";
import { Loader2, MousePointerClick } from "lucide-react";

interface DetailPanelProps {
  selectedVisit: VisitListItem | null;
  onVisitUpdated: () => void;
}

export function DetailPanel({ selectedVisit, onVisitUpdated }: DetailPanelProps) {
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

  if (!selectedVisit) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-3">
        <MousePointerClick className="w-8 h-8 opacity-40" />
        <p className="text-sm">Select a visit to view details</p>
      </div>
    );
  }

  if (loading || !visitDetail) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const status = visitDetail.status;

  if (status === "intake" || status === "triaged") {
    return <IntakeDetail visit={visitDetail} />;
  }

  if (status === "auto_routed" || status === "pending_review") {
    return <ReviewDetail visit={visitDetail} onVisitUpdated={onVisitUpdated} />;
  }

  if (status === "routed") {
    return <RoutedDetail visit={visitDetail} onVisitUpdated={onVisitUpdated} />;
  }

  if (status === "in_department") {
    return <DepartmentDetail visit={visitDetail} onVisitUpdated={onVisitUpdated} />;
  }

  return (
    <div className="flex items-center justify-center h-full text-muted-foreground">
      <p className="text-sm">Unknown visit status: {status}</p>
    </div>
  );
}
