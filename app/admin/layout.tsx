import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { loadAdminConfig } from "@/lib/admin/config";
import { readSession } from "@/lib/admin/session";
import { AdminShell } from "@/components/admin/admin-shell";

/**
 * Every admin page reads cookies and, eventually, the filesystem - a
 * cached admin response is a correctness bug (a stale session state, a
 * stale content listing), not an optimisation worth having (D8).
 */
export const dynamic = "force-dynamic";

/** Never indexed, never crawled - true regardless of whether the panel is
 * actually reachable, since a `noindex` header on a 404 is harmless and
 * this metadata must not itself become a tell that flips based on
 * enabled state. */
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

/**
 * Gates every route under `/admin` on the panel being enabled and
 * validly configured (D-fail-closed) - `loadAdminConfig()` throws for
 * both a disabled panel and a misconfigured one, and both cases get the
 * exact same treatment here: a real 404, not a redirect, so neither state
 * is distinguishable from this route simply not existing.
 *
 * Does not itself enforce authentication - it reads a session only to
 * hand the topbar a username to display. Per D3, every page (this
 * branch's `app/admin/page.tsx`) independently calls
 * `requireAdminSession()`; this layout renders around whatever that page
 * decides to do, including redirecting away.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  try {
    loadAdminConfig();
  } catch {
    notFound();
  }

  const session = await readSession();

  return <AdminShell username={session?.username ?? null}>{children}</AdminShell>;
}
