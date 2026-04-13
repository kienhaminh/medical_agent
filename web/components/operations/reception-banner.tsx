// web/components/operations/reception-banner.tsx
"use client";

import type { VisitListItem } from "@/lib/api";

interface ReceptionBannerProps {
  visits: VisitListItem[];
  onClick: () => void;
}

export function ReceptionBanner({ visits, onClick }: ReceptionBannerProps) {
  const intakeCount = visits.filter(
    (v) => v.status === "intake" || v.status === "triaged"
  ).length;
  const routingCount = visits.filter((v) => v.status === "auto_routed").length;
  const reviewCount = visits.filter(
    (v) => v.status === "pending_review" || v.status === "routed"
  ).length;
  const pendingReviewCount = visits.filter(
    (v) => v.status === "pending_review"
  ).length;

  const hasReview = pendingReviewCount > 0;

  return (
    <button
      onClick={onClick}
      className="w-full text-left rounded-xl border border-border px-6 py-4 transition-all hover:bg-muted/30 focus:outline-none"
    >
      <div className="text-sm font-bold font-mono text-foreground mb-3 tracking-widest flex items-center gap-2">
        RECEPTION
        {visits.length > 0 && (
          <span className="text-xs px-1.5 py-0.5 rounded font-mono bg-muted text-muted-foreground border border-border">
            {visits.length}
          </span>
        )}
        {hasReview && (
          <span className="text-xs px-2 py-0.5 rounded font-mono bg-amber-500/10 text-amber-500 border border-amber-500/30">
            review needed
          </span>
        )}
      </div>
      <div className="flex items-center gap-3 text-[11px] font-mono text-muted-foreground">
        {visits.length === 0 ? (
          <span>No patients in reception</span>
        ) : (
          <>
            <span className="px-2 py-0.5 rounded border border-border bg-muted/50">intake: {intakeCount}</span>
            <span className="px-2 py-0.5 rounded border border-border bg-muted/50">routing: {routingCount}</span>
            <span className={`px-2 py-0.5 rounded border ${
              hasReview
                ? "text-amber-500 bg-amber-500/10 border-amber-500/30"
                : "border-border bg-muted/50"
            }`}>review: {reviewCount}</span>
          </>
        )}
      </div>
    </button>
  );
}
