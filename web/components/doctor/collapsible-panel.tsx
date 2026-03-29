"use client";

import { ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

interface CollapsiblePanelProps {
  id: string;
  title: string;
  icon: LucideIcon;
  iconColor?: string;
  badge?: string;
  collapsed: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}

export function CollapsiblePanel({
  title,
  icon: Icon,
  iconColor = "text-cyan-500",
  badge,
  collapsed,
  onToggle,
  children,
}: CollapsiblePanelProps) {
  return (
    <div className="border border-border rounded-lg overflow-hidden">
      {/* Header — always visible */}
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-3 py-2.5 bg-muted/30 border-b border-border hover:bg-muted/50 transition-colors"
      >
        <div className="flex items-center gap-2 min-w-0">
          <Icon className={cn("h-4 w-4 shrink-0", iconColor)} />
          <span className="text-sm font-medium">{title}</span>
          {badge && (
            <span className="text-[10px] text-muted-foreground truncate">
              · {badge}
            </span>
          )}
        </div>
        {collapsed ? (
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        ) : (
          <ChevronUp className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        )}
      </button>

      {/* Content — conditionally rendered */}
      {!collapsed && <div>{children}</div>}
    </div>
  );
}
