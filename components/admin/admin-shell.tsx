"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";

import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { AdminSidebar } from "@/components/admin/admin-sidebar";
import { AdminTopbar } from "@/components/admin/admin-topbar";

/**
 * The admin panel's chrome: sidebar + topbar around `children`, or just
 * `children` alone on `/admin/login`.
 *
 * This is a Client Component - not `app/admin/layout.tsx` itself - purely
 * because deciding "is this the login route" needs `usePathname()`, and a
 * layout has no equivalent server-side access to the current pathname.
 * `app/admin/layout.tsx` always renders this component; this component
 * decides what to actually show.
 */
export function AdminShell({ username, children }: { username: string | null; children: ReactNode }) {
  const pathname = usePathname();

  if (pathname === "/admin/login") {
    return children;
  }

  return (
    <SidebarProvider>
      <AdminSidebar />
      <SidebarInset>
        <AdminTopbar username={username} />
        <div className="flex flex-1 flex-col gap-4 p-4 md:p-6">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
