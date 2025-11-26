"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import Image from "next/image";
import {
  Users,
  MessageSquare,
  Settings,
  Sliders,
  Home,
  ChevronDown,
  ChevronRight,
  History,
  BarChart3,
  PanelLeftClose,
  PanelLeft,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface NavItem {
  name: string;
  href: string;
  icon: any;
  subItems?: { name: string; href: string; icon: any }[];
}

const navigation: NavItem[] = [
  {
    name: "Patients",
    href: "/patient",
    icon: Users,
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
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [expandedItems, setExpandedItems] = useState<string[]>(["Agent"]);
  const [isCollapsed, setIsCollapsed] = useState(false);

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
    // Exact match for /agent route (History)
    if (subHref === "/agent") {
      return pathname === "/agent";
    }
    // For other routes, check if pathname starts with the href
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

      {/* Footer */}
      <div className="border-t border-border p-4">
        {isCollapsed ? (
          <div className="flex justify-center" title="All systems operational">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
          </div>
        ) : (
          <div className="text-xs text-muted-foreground space-y-1">
            <p className="font-medium">System Status</p>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              <span>All systems operational</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
