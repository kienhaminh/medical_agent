"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import Image from "next/image";
import {
  Users,
  MessageSquare,
  Settings,
  ChevronDown,
  ChevronRight,
  History,
  BarChart3,
  PanelLeftClose,
  PanelLeft,
  Palette,
  Monitor,
  Stethoscope,
  Shield,
  LogOut,
  User,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";
import { canAccessRoute } from "@/lib/auth-context";

interface NavItem {
  name: string;
  href: string;
  icon: LucideIcon;
  subItems?: { name: string; href: string; icon: LucideIcon }[];
}

/** All navigation items. Filtered by role at render time. */
const ALL_NAVIGATION: NavItem[] = [
  {
    name: "Doctor Portal",
    href: "/doctor",
    icon: Stethoscope,
  },
  {
    name: "Officer Portal",
    href: "/officer",
    icon: Shield,
  },
  {
    name: "Patients",
    href: "/patient",
    icon: Users,
  },
  {
    name: "Operations",
    href: "/operations",
    icon: Monitor,
  },
  {
    name: "Agent",
    href: "/agent",
    icon: MessageSquare,
    subItems: [
      { name: "Chat", href: "/agent", icon: MessageSquare },
      { name: "History", href: "/agent/history", icon: History },
      { name: "Settings", href: "/agent/settings", icon: Settings },
      { name: "Usage", href: "/agent/usage", icon: BarChart3 },
    ],
  },
  {
    name: "Design System",
    href: "/design-system",
    icon: Palette,
  },
];

const ROLE_COLORS: Record<string, string> = {
  doctor: "text-emerald-400",
  officer: "text-blue-400",
  admin: "text-purple-400",
};

const ROLE_LABELS: Record<string, string> = {
  doctor: "Doctor",
  officer: "Officer",
  admin: "Admin",
};

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();
  const [expandedItems, setExpandedItems] = useState<string[]>(["Agent"]);
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Filter navigation by user role
  const navigation = useMemo(() => {
    if (!user) return [];
    return ALL_NAVIGATION.filter((item) => canAccessRoute(user.role, item.href));
  }, [user]);

  const toggleExpand = (itemName: string) => {
    setExpandedItems((prev) =>
      prev.includes(itemName)
        ? prev.filter((name) => name !== itemName)
        : [...prev, itemName]
    );
  };

  const isItemActive = (item: NavItem) => {
    if (item.subItems) {
      return item.subItems.some(
        (sub) => pathname === sub.href || pathname?.startsWith(sub.href + "/")
      );
    }
    return pathname === item.href || pathname?.startsWith(item.href + "/");
  };

  const isSubItemActive = (subHref: string) => {
    if (subHref === "/agent") {
      return pathname === "/agent";
    }
    return pathname === subHref || pathname?.startsWith(subHref + "/");
  };

  return (
    <div
      className={cn(
        "flex h-screen flex-col border-r border-border bg-card/30 backdrop-blur-xl transition-all duration-300",
        isCollapsed ? "w-16" : "w-64"
      )}
    >
      {/* Logo */}
      <div className="flex h-16 items-center gap-3 border-b border-border px-3 justify-between">
        {!isCollapsed && (
          <div
            className="flex items-center gap-3 cursor-pointer"
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
        )}
        {isCollapsed && (
          <div
            className="relative mx-auto cursor-pointer w-10 h-10"
            onClick={() => router.push("/")}
          >
            <Image
              src="/logo.png"
              alt="MediNexus Logo"
              width={40}
              height={40}
              className="object-contain"
              unoptimized
            />
          </div>
        )}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="hover:bg-cyan-500/10 flex-shrink-0"
        >
          {isCollapsed ? (
            <PanelLeft className="w-4 h-4" />
          ) : (
            <PanelLeftClose className="w-4 h-4" />
          )}
        </Button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 px-3 py-4 overflow-y-auto">
        {navigation.map((item) => {
          const isActive = isItemActive(item);
          const Icon = item.icon;
          const isExpanded = expandedItems.includes(item.name);
          const hasSubItems = item.subItems && item.subItems.length > 0;

          return (
            <div key={item.name}>
              {hasSubItems ? (
                <>
                  {isCollapsed ? (
                    <Link
                      href={item.href}
                      className={cn(
                        "flex items-center justify-center rounded-lg px-3 py-2 text-sm font-medium transition-all duration-150",
                        isActive
                          ? "bg-linear-to-r from-cyan-500/10 to-teal-500/10 text-cyan-500"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground"
                      )}
                      title={item.name}
                    >
                      <Icon className="w-5 h-5" />
                    </Link>
                  ) : (
                    <>
                      <button
                        onClick={() => toggleExpand(item.name)}
                        className={cn(
                          "flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm font-medium transition-all duration-150",
                          isActive
                            ? "bg-linear-to-r from-cyan-500/10 to-teal-500/10 text-cyan-500"
                            : "text-muted-foreground hover:bg-muted hover:text-foreground"
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <Icon className="w-5 h-5" />
                          {item.name}
                        </div>
                        {isExpanded ? (
                          <ChevronDown className="w-4 h-4 transition-transform duration-150" />
                        ) : (
                          <ChevronRight className="w-4 h-4 transition-transform duration-150" />
                        )}
                      </button>

                      {isExpanded && item.subItems && (
                        <div className="ml-4 mt-1 space-y-1 border-l-2 border-border pl-4 animate-in fade-in slide-in-from-top-2 duration-150">
                          {item.subItems.map((subItem) => {
                            const SubIcon = subItem.icon;
                            const isSubActive = isSubItemActive(subItem.href);

                            return (
                              <Link
                                key={subItem.name}
                                href={subItem.href}
                                className={cn(
                                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-150",
                                  isSubActive
                                    ? "bg-linear-to-r from-cyan-500/10 to-teal-500/10 text-cyan-500 medical-border-glow"
                                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                                )}
                              >
                                <SubIcon className="w-4 h-4" />
                                {subItem.name}
                              </Link>
                            );
                          })}
                        </div>
                      )}
                    </>
                  )}
                </>
              ) : (
                <Link
                  href={item.href}
                  className={cn(
                    "flex items-center rounded-lg px-3 py-2 text-sm font-medium transition-all",
                    isCollapsed ? "justify-center" : "gap-3",
                    isActive
                      ? "bg-linear-to-r from-cyan-500/10 to-teal-500/10 text-cyan-500 medical-border-glow"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                  title={isCollapsed ? item.name : undefined}
                >
                  <Icon className="w-5 h-5" />
                  {!isCollapsed && item.name}
                </Link>
              )}
            </div>
          );
        })}
      </nav>

      {/* User Info + Logout */}
      <div className="border-t border-border p-3 space-y-2">
        {user && !isCollapsed && (
          <div className="flex items-center gap-2 px-2 py-1">
            <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
              <User className="w-4 h-4 text-muted-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{user.name}</p>
              <p className={cn("text-xs font-medium", ROLE_COLORS[user.role] || "text-muted-foreground")}>
                {ROLE_LABELS[user.role] || user.role}
              </p>
            </div>
          </div>
        )}
        <Button
          variant="ghost"
          size={isCollapsed ? "icon" : "sm"}
          onClick={logout}
          className={cn(
            "hover:bg-red-500/10 hover:text-red-400 text-muted-foreground",
            isCollapsed ? "" : "w-full justify-start gap-2"
          )}
          title={isCollapsed ? "Sign out" : undefined}
        >
          <LogOut className="w-4 h-4" />
          {!isCollapsed && "Sign out"}
        </Button>
      </div>
    </div>
  );
}
