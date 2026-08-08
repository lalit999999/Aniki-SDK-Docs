"use client";

import { usePathname } from "next/navigation";

/**
 * Wraps `DocsHeader`/`DocsFooter` in `app/layout.tsx` and suppresses both
 * under `/admin` (D7). The root layout renders unconditionally for every
 * route today, including the admin panel's own chrome
 * (`components/admin/admin-shell.tsx`) - refactoring every existing route
 * into a `(site)` route group to exclude `/admin` would touch dozens of
 * files already owned by, or in flight on, Prompts B and C's branches.
 * Wrapping the two chrome components in a pathname check is a two-line
 * edit to one shared file instead.
 */
export function SiteChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  if (pathname.startsWith("/admin")) {
    return null;
  }

  return children;
}
