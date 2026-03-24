// web/app/(dashboard)/doctor/queue/page.tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { VisitQueueCard } from "@/components/doctor/visit-queue-card";
import { RouteApprovalDialog } from "@/components/doctor/route-approval-dialog";
import { IntakeViewerDialog } from "@/components/doctor/intake-viewer-dialog";
import { listVisits, routeVisit, type VisitDetail } from "@/lib/api";
import { Loader2 } from "lucide-react";

export default function DoctorQueuePage() {
  const [visits, setVisits] = useState<VisitDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("needs_review");

  // Dialog state
  const [routeDialogVisit, setRouteDialogVisit] = useState<VisitDetail | null>(null);
  const [intakeViewerVisit, setIntakeViewerVisit] = useState<VisitDetail | null>(null);

  const fetchVisits = useCallback(async () => {
    try {
      // Fetch all non-intake visits (we cast to VisitDetail — list endpoint returns enough data)
      const data = await listVisits();
      const nonIntake = data.filter((v) => v.status !== "intake") as unknown as VisitDetail[];
      setVisits(nonIntake);
    } catch (err) {
      console.error("Failed to fetch visits:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchVisits();
    // Poll every 5 seconds
    const interval = setInterval(fetchVisits, 5000);
    return () => clearInterval(interval);
  }, [fetchVisits]);

  const needsReview = visits.filter((v) => v.status === "pending_review");
  const autoRouted = visits.filter((v) => v.status === "auto_routed");

  const handleApprove = async (visit: VisitDetail) => {
    if (!visit.routing_suggestion) return;
    try {
      await routeVisit(visit.id, visit.routing_suggestion, "Doctor (quick approve)");
      fetchVisits();
    } catch (err) {
      console.error("Failed to approve route:", err);
    }
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <h1 className="font-display text-2xl font-bold mb-6">Doctor&apos;s Queue</h1>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-6">
          <TabsTrigger value="needs_review">
            Needs Review ({needsReview.length})
          </TabsTrigger>
          <TabsTrigger value="auto_routed">
            Auto-Routed ({autoRouted.length})
          </TabsTrigger>
          <TabsTrigger value="all">
            All Visits ({visits.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="needs_review">
          <VisitList
            visits={needsReview}
            onApprove={handleApprove}
            onChangeRoute={setRouteDialogVisit}
            onViewIntake={setIntakeViewerVisit}
            emptyMessage="No visits pending review"
          />
        </TabsContent>

        <TabsContent value="auto_routed">
          <VisitList
            visits={autoRouted}
            onApprove={handleApprove}
            onChangeRoute={setRouteDialogVisit}
            onViewIntake={setIntakeViewerVisit}
            emptyMessage="No auto-routed visits"
          />
        </TabsContent>

        <TabsContent value="all">
          <VisitList
            visits={visits}
            onApprove={handleApprove}
            onChangeRoute={setRouteDialogVisit}
            onViewIntake={setIntakeViewerVisit}
            emptyMessage="No visits yet"
          />
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      <RouteApprovalDialog
        visit={routeDialogVisit}
        open={!!routeDialogVisit}
        onClose={() => setRouteDialogVisit(null)}
        onRouted={fetchVisits}
      />
      <IntakeViewerDialog
        visit={intakeViewerVisit}
        open={!!intakeViewerVisit}
        onClose={() => setIntakeViewerVisit(null)}
      />
    </div>
  );
}

function VisitList({
  visits,
  onApprove,
  onChangeRoute,
  onViewIntake,
  emptyMessage,
}: {
  visits: VisitDetail[];
  onApprove: (v: VisitDetail) => void;
  onChangeRoute: (v: VisitDetail) => void;
  onViewIntake: (v: VisitDetail) => void;
  emptyMessage: string;
}) {
  if (visits.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground border-2 border-dashed border-border/50 rounded-lg">
        <p>{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {visits.map((visit) => (
        <VisitQueueCard
          key={visit.id}
          visit={visit}
          onApprove={onApprove}
          onChangeRoute={onChangeRoute}
          onViewIntake={onViewIntake}
        />
      ))}
    </div>
  );
}
