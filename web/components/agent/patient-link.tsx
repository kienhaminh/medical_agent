"use client";

import { useRouter } from "next/navigation";
import { User } from "lucide-react";
import { cn } from "@/lib/utils";

interface PatientLinkProps {
  patientId: number;
  patientName: string;
  sessionId?: string;
  className?: string;
}

export function PatientLink({
  patientId,
  patientName,
  sessionId,
  className,
}: PatientLinkProps) {
  const router = useRouter();

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    const url = sessionId
      ? `/patient/${patientId}?session=${sessionId}`
      : `/patient/${patientId}`;
    router.push(url);
  };

  return (
    <span
      onClick={handleClick}
      className={cn(
        "inline-flex items-center gap-1 cursor-pointer",
        "text-cyan-400 hover:text-cyan-300",
        "underline decoration-cyan-500/50 hover:decoration-cyan-400",
        "transition-all duration-200",
        "hover:drop-shadow-[0_0_8px_rgba(34,211,238,0.4)]",
        "group relative",
        className
      )}
      role="link"
      tabIndex={0}
      aria-label={`View details for patient ${patientName}`}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          handleClick(e as any);
        }
      }}
    >
      <User className="w-3.5 h-3.5 inline-block opacity-70 group-hover:opacity-100" />
      <span className="font-medium">{patientName}</span>
      <span className="absolute -bottom-6 left-1/2 -translate-x-1/2 px-2 py-1 bg-slate-900/95 backdrop-blur-sm text-cyan-300 text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10 border border-cyan-500/20">
        View Patient Details
      </span>
    </span>
  );
}
