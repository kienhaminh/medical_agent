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

  const hasReview = reviewCount > 0;

  return (
    <button
      onClick={onClick}
      className={`w-full text-left rounded-xl border px-6 py-4 transition-all hover:brightness-110 focus:outline-none ${hasReview ? "animate-pulse" : ""}`}
      style={{
        background: "rgba(0, 217, 255, 0.06)",
        borderColor: hasReview
          ? "rgba(245, 158, 11, 0.6)"
          : "rgba(0, 217, 255, 0.4)",
        boxShadow: hasReview
          ? "0 0 20px rgba(245, 158, 11, 0.15)"
          : "0 0 15px rgba(0, 217, 255, 0.1)",
      }}
    >
      <div className="text-sm font-bold font-mono text-[#00d9ff] mb-3 tracking-widest flex items-center gap-2">
        RECEPTION
        {visits.length > 0 && (
          <span className="text-xs px-1.5 py-0.5 rounded-full font-mono"
            style={{ background: "rgba(0,217,255,0.12)", color: "#00d9ff" }}>
            {visits.length}
          </span>
        )}
      </div>
      <div className="flex items-center gap-4 text-[12px] font-mono">
        <span
          className="px-2.5 py-1 rounded-full"
          style={{
            color: "#00d9ff",
            background: "rgba(0, 217, 255, 0.12)",
            border: "1px solid rgba(0, 217, 255, 0.25)",
          }}
        >
          intake: {intakeCount}
        </span>
        <span
          className="px-2.5 py-1 rounded-full"
          style={{
            color: "#a78bfa",
            background: "rgba(167, 139, 250, 0.12)",
            border: "1px solid rgba(167, 139, 250, 0.25)",
          }}
        >
          routing: {routingCount}
        </span>
        <span
          className="px-2.5 py-1 rounded-full"
          style={{
            color: hasReview ? "#f59e0b" : "#8b949e",
            background: hasReview
              ? "rgba(245, 158, 11, 0.12)"
              : "rgba(139, 148, 158, 0.08)",
            border: hasReview
              ? "1px solid rgba(245, 158, 11, 0.3)"
              : "1px solid rgba(139, 148, 158, 0.15)",
          }}
        >
          review: {reviewCount}
        </span>
        {visits.length === 0 && (
          <span className="text-[#8b949e]">No patients in reception</span>
        )}
      </div>
    </button>
  );
}
