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
      className="w-full text-left rounded-xl border border-border px-6 py-4 transition-all hover:brightness-110 focus:outline-none bg-primary/[0.06]"
    >
      <div className="text-sm font-bold font-mono text-primary mb-3 tracking-widest flex items-center gap-2">
        RECEPTION
        {visits.length > 0 && (
          <span className="text-xs px-1.5 py-0.5 rounded-full font-mono bg-primary/[0.12] text-primary">
            {visits.length}
          </span>
        )}
        {hasReview && (
          <span className="text-xs px-2 py-0.5 rounded-full font-mono bg-amber-500/[0.15] text-amber-500 border border-amber-500/30">
            review needed
          </span>
        )}
      </div>
      <div className="flex items-center gap-4 text-[12px] font-mono">
        <span className="px-2.5 py-1 rounded-full border text-primary bg-primary/[0.12] border-primary/25">
          intake: {intakeCount}
        </span>
        <span className="px-2.5 py-1 rounded-full border text-violet-400 bg-violet-400/[0.12] border-violet-400/25">
          routing: {routingCount}
        </span>
        <span className={`px-2.5 py-1 rounded-full border ${
          hasReview
            ? "text-amber-500 bg-amber-500/[0.12] border-amber-500/30"
            : "text-muted-foreground bg-transparent border-border"
        }`}>
          review: {reviewCount}
        </span>
        {visits.length === 0 && (
          <span className="text-muted-foreground">No patients in reception</span>
        )}
      </div>
    </button>
  );
}
