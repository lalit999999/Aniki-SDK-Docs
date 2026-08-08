/**
 * The admin panel's top-level navigation - the single source
 * `admin-sidebar.tsx` and `admin-topbar.tsx` read from, so a new section
 * is added in exactly one place. This file (with `types.ts`) is the whole
 * reason Prompts B and C never touch `app/admin/layout.tsx` or the
 * sidebar/topbar components themselves: their pages just need to exist at
 * the hrefs already declared here, and B's `/admin/content`, C's
 * `/admin/versions` / `/admin/analytics` / `/admin/seo` are all present
 * below even though only this branch's `/admin` (Overview) resolves to a
 * real page today - the rest 404 until B and C merge, which is expected.
 *
 * Client-safe by construction (no `server-only`, no filesystem access):
 * both sidebar and topbar are Client Components that import this
 * directly.
 */

import type { IconSvgElement } from "@hugeicons/react";
import {
  Analytics01Icon,
  DashboardSquare01Icon,
  File01Icon,
  GlobalSearchIcon,
  Tag01Icon,
} from "@hugeicons/core-free-icons";

/** One entry in the admin sidebar. */
export interface AdminNavItem {
  readonly label: string;
  readonly href: string;
  readonly icon: IconSvgElement;
  /** One-line summary shown as the sidebar item's tooltip/topbar
   * breadcrumb description. */
  readonly description: string;
}

/**
 * Every top-level admin section, in the order the sidebar renders them.
 *
 * @example
 * ```tsx
 * {ADMIN_NAV.map((item) => <SidebarLink key={item.href} {...item} />)}
 * ```
 */
export const ADMIN_NAV: readonly AdminNavItem[] = [
  {
    label: "Overview",
    href: "/admin",
    icon: DashboardSquare01Icon,
    description: "Content health and version status at a glance.",
  },
  {
    label: "Content",
    href: "/admin/content",
    icon: File01Icon,
    description: "Create, edit, and publish documentation pages.",
  },
  {
    label: "Versions",
    href: "/admin/versions",
    icon: Tag01Icon,
    description: "Manage declared documentation versions.",
  },
  {
    label: "Analytics",
    href: "/admin/analytics",
    icon: Analytics01Icon,
    description: "Page views and search terms from visitors.",
  },
  {
    label: "SEO",
    href: "/admin/seo",
    icon: GlobalSearchIcon,
    description: "Sitemap, robots, and per-page metadata.",
  },
];
