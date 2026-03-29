"use client";

import { usePathname } from "next/navigation";
import { Sidebar } from "@/components/sidebar";

/** Routes that render their own full-width workstation layout */
const FULL_WIDTH_ROUTES = ["/doctor", "/nurse"];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const hideSidebar = FULL_WIDTH_ROUTES.some((r) => pathname === r || pathname?.startsWith(r + "/"));

  return (
    <div className="flex h-screen overflow-hidden">
      {!hideSidebar && <Sidebar />}
      <main className="flex-1 overflow-hidden">{children}</main>
    </div>
  );
}
