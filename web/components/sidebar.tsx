"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import Image from "next/image";
import {
  MessageSquare,
  Settings,
  History,
  BarChart3,
  Monitor,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth-context";

interface NavItem {
  name: string;
  href: string;
  icon: LucideIcon;
  roles?: string[]; // if set, only visible to these roles
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

const navigationGroups: NavGroup[] = [
  {
    label: "Metrics",
    items: [
      { name: "Operations", href: "/operations", icon: Monitor },
    ],
  },
  {
    label: "Agent",
    items: [
      { name: "Chat", href: "/agent", icon: MessageSquare },
      { name: "History", href: "/agent/history", icon: History },
      { name: "Settings", href: "/agent/settings", icon: Settings, roles: ["admin"] },
      { name: "Usage", href: "/agent/usage", icon: BarChart3, roles: ["admin"] },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useAuth();

  const isItemActive = (item: NavItem) => {
    if (item.href === "/agent") {
      return pathname === "/agent";
    }
    return pathname === item.href || pathname?.startsWith(item.href + "/");
  };

  return (
    <div className="flex h-screen w-64 flex-col border-r border-border bg-card/30 backdrop-blur-xl">
      {/* Logo */}
      <div
        className="flex h-16 items-center gap-3 border-b border-border px-4 cursor-pointer"
        onClick={() => router.push("/")}
      >
        <div className="relative w-10 h-10 shrink-0">
          <Image
            src="/logo.png"
            alt="MediNexus Logo"
            width={40}
            height={40}
            className="object-contain"
            unoptimized
          />
        </div>
        <span className="font-display text-lg font-bold tracking-wider bg-linear-to-r from-cyan-500 to-teal-500 bg-clip-text text-transparent">
          MEDI-NEXUS
        </span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 overflow-y-auto space-y-5">
        {navigationGroups.map((group) => (
          <div key={group.label}>
            <p className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50">
              {group.label}
            </p>

            <div className="space-y-1">
              {group.items.filter((item) => !item.roles || item.roles.includes(user?.role ?? "")).map((item) => {
                const isActive = isItemActive(item);
                const Icon = item.icon;

                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all",
                      isActive
                        ? "bg-linear-to-r from-cyan-500/10 to-teal-500/10 text-cyan-500 medical-border-glow"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                  >
                    <Icon className="w-5 h-5" />
                    {item.name}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="border-t border-border p-4">
        <div className="text-xs text-muted-foreground space-y-1">
          <p className="font-medium">System Status</p>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
            <span className="text-emerald-500 font-medium">
              All systems operational
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
