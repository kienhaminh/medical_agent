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

  const navigate = () => {
    const url = sessionId
      ? `/patient/${patientId}?session=${sessionId}`
      : `/patient/${patientId}`;
    router.push(url);
  };

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    navigate();
  };

  return (
    <span
      onClick={handleClick}
      className={cn(
        "inline-flex items-center gap-1 cursor-pointer",
        "text-primary hover:text-primary",
        "underline decoration-primary/50 hover:decoration-primary",
        "transition-all duration-200",
        "hover:drop-shadow-sm",
        "group relative",
        className
      )}
      role="link"
      tabIndex={0}
      aria-label={`View details for patient ${patientName}`}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          navigate();
        }
      }}
    >
      <User className="w-3.5 h-3.5 inline-block opacity-70 group-hover:opacity-100" />
      <span className="font-medium">{patientName}</span>
      <span className="absolute -bottom-6 left-1/2 -translate-x-1/2 px-2 py-1 bg-slate-900/95 backdrop-blur-sm text-primary text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10 border border-primary/20">
        View Patient Details
      </span>
    </span>
  );
}
