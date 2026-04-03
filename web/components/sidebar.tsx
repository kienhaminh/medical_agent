"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import Image from "next/image";
import {
  MessageSquare,
  Monitor,
  LogOut,
  UserRound,
  BriefcaseMedical,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth-context";
import { ThemeToggle } from "@/components/theme-toggle";

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
    label: "Workspace",
    items: [
      { name: "Clinical Workstation", href: "/doctor", icon: BriefcaseMedical, roles: ["doctor"] },
      { name: "Admin Portal", href: "/admin", icon: UserRound, roles: ["admin"] },
    ],
  },
  {
    label: "Metrics",
    items: [
      { name: "Operations", href: "/operations", icon: Monitor, roles: ["admin"] },
    ],
  },
  {
    label: "Agent",
    items: [
      { name: "Chat", href: "/agent", icon: MessageSquare },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();

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
        <span className="font-display text-lg font-bold tracking-wider text-primary">
          MEDERA
        </span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 overflow-y-auto space-y-5">
        {navigationGroups.map((group) => {
          const visibleItems = group.items.filter((item) => !item.roles || item.roles.includes(user?.role ?? ""));
          if (visibleItems.length === 0) return null;
          return (
          <div key={group.label}>
            <p className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50">
              {group.label}
            </p>

            <div className="space-y-1">
              {visibleItems.map((item) => {
                const isActive = isItemActive(item);
                const Icon = item.icon;

                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all",
                      isActive
                        ? "bg-primary/10 text-primary medical-border-glow"
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
          );
        })}
      </nav>

      {/* Footer */}
      <div className="border-t border-border p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="text-xs text-muted-foreground space-y-1">
            <p className="font-medium">System Status</p>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
              <span className="text-emerald-500 font-medium">
                Operational
              </span>
            </div>
          </div>
          <ThemeToggle />
        </div>

        {user && (
          <button
            onClick={logout}
            className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <LogOut className="w-4 h-4 shrink-0" />
            <span className="truncate">Sign out</span>
          </button>
        )}
      </div>
    </div>
  );
}
