"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { HugeiconsIcon } from "@hugeicons/react";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";
import { ADMIN_NAV } from "@/lib/admin/nav";
import { siteConfig } from "@/config/site";

/**
 * Whether `href` is the currently active nav item, treating `/admin`
 * (Overview) as exact-match only - otherwise every other section would
 * also read as "inside Overview" - and every other item as active for
 * its own nested routes too (`/admin/content/v1/slug` keeps "Content"
 * highlighted).
 */
function isActiveHref(pathname: string, href: string): boolean {
  if (href === "/admin") {
    return pathname === "/admin";
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * The admin panel's primary navigation, built from `ADMIN_NAV` (D-nav) so
 * this component never changes when a new section is added. Active state
 * comes from `usePathname()`, including nested routes; every link is a
 * real `<a>` (via `SidebarMenuButton`'s `asChild`), so keyboard navigation
 * and the design system's focus rings work without extra wiring here.
 */
export function AdminSidebar() {
  const pathname = usePathname();

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <Link
          href="/admin"
          className="flex items-center gap-2 rounded-xl px-2 py-1.5 font-heading text-sm font-semibold text-foreground outline-hidden focus-visible:ring-2 focus-visible:ring-ring/30"
        >
          <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
            A
          </span>
          <span className="truncate group-data-[collapsible=icon]:hidden">{siteConfig.name} Admin</span>
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {ADMIN_NAV.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton asChild isActive={isActiveHref(pathname, item.href)} tooltip={item.description}>
                    <Link href={item.href}>
                      <HugeiconsIcon icon={item.icon} strokeWidth={2} />
                      <span>{item.label}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  );
}
