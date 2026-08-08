import Link from "next/link";
import { redirect } from "next/navigation";
import { HugeiconsIcon } from "@hugeicons/react";
import { Alert01Icon, Clock01Icon, Delete02Icon, File01Icon, File02Icon, Tag01Icon } from "@hugeicons/core-free-icons";

import { requireAdminSession } from "@/lib/admin/session";
import { UnauthorizedError } from "@/lib/admin/errors";
import { getAllDocs, getDocVersions } from "@/lib/content";
import type { Doc } from "@/lib/content";
import type { DocsVersionSummary } from "@/lib/versions";
import { StatCard } from "@/components/admin/stat-card";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";

/** Reads the session cookie and the filesystem on every request - a
 * cached dashboard is a correctness bug (D8, D9): its counters must never
 * drift from what the site is actually serving right now. */
export const dynamic = "force-dynamic";

const STALE_THRESHOLD_DAYS = 180;
const STALE_THRESHOLD_MS = STALE_THRESHOLD_DAYS * 24 * 60 * 60 * 1000;

interface DashboardData {
  readonly versions: readonly DocsVersionSummary[];
  readonly docs: readonly Doc[];
}

/**
 * Loads every document across every declared version (D9) - `getAllDocs()`
 * with no argument only covers the latest version, so the dashboard has to
 * fan out over `getDocVersions()` itself to get a true site-wide count.
 *
 * @throws Whatever `getDocVersions`/`getAllDocs` throw (a `ContentError`
 * subclass) when `content/docs` is missing or unreadable - left
 * unhandled here so the page component's own try/catch can render a
 * failure card instead of crashing the whole route.
 */
async function loadDashboardData(): Promise<DashboardData> {
  const versions = await getDocVersions();
  const perVersion = await Promise.all(versions.map((version) => getAllDocs(version.id)));
  return { versions, docs: perVersion.flat() };
}

interface StalestDoc {
  readonly doc: Doc;
  readonly updatedAt: string;
}

/** The document with the oldest known `updatedAt`, or `null` if none of
 * `docs` has one. Returning the resolved `updatedAt` alongside the doc
 * (rather than re-reading `doc.meta.updatedAt`, which is typed
 * `string | null`) keeps the caller from needing a non-null assertion to
 * use it. */
function findStalestDoc(docs: readonly Doc[]): StalestDoc | null {
  let stalest: StalestDoc | null = null;
  let stalestTime = Number.POSITIVE_INFINITY;
  for (const doc of docs) {
    const { updatedAt } = doc.meta;
    if (updatedAt === null) {
      continue;
    }
    const time = new Date(updatedAt).getTime();
    if (time < stalestTime) {
      stalestTime = time;
      stalest = { doc, updatedAt };
    }
  }
  return stalest;
}

interface HealthIssue {
  readonly key: string;
  readonly title: string;
  readonly version: string;
  readonly slug: string;
  readonly href: string;
  readonly reason: string;
}

/**
 * The three content-health checks the sub-task calls for: a missing
 * description, no declared/derived `updated` date, and an `updated` date
 * over {@link STALE_THRESHOLD_DAYS} old. A single page can trigger more
 * than one - each becomes its own row, since each names a distinct fix.
 *
 * Every issue links to `/admin/content/<version>/<slug>` (Prompt B's
 * route) - a dead link on this branch, correct once B merges.
 */
function buildHealthIssues(docs: readonly Doc[]): HealthIssue[] {
  const issues: HealthIssue[] = [];
  const now = Date.now();

  for (const doc of docs) {
    const { meta } = doc;
    const href = `/admin/content/${meta.version}/${meta.slug}`;

    if (meta.description.trim().length === 0) {
      issues.push({
        key: `${meta.version}-${meta.slug}-description`,
        title: meta.title,
        version: meta.version,
        slug: meta.slug,
        href,
        reason: "Missing description",
      });
    }

    if (meta.updatedAt === null) {
      issues.push({
        key: `${meta.version}-${meta.slug}-updated`,
        title: meta.title,
        version: meta.version,
        slug: meta.slug,
        href,
        reason: "No updated date",
      });
    } else if (now - new Date(meta.updatedAt).getTime() > STALE_THRESHOLD_MS) {
      issues.push({
        key: `${meta.version}-${meta.slug}-stale`,
        title: meta.title,
        version: meta.version,
        slug: meta.slug,
        href,
        reason: `Updated over ${STALE_THRESHOLD_DAYS} days ago`,
      });
    }
  }

  return issues;
}

/**
 * The admin dashboard: live counters plus a content-health list, both
 * sourced from `@/lib/content` directly (D9) rather than any snapshot, so
 * they can never drift from what `/docs` actually serves.
 *
 * Calls `requireAdminSession()` itself (D3) rather than trusting
 * `app/admin/layout.tsx` or `proxy.ts` - both exist, but neither is the
 * authorization boundary this route is responsible for enforcing.
 */
export default async function AdminDashboardPage() {
  try {
    await requireAdminSession();
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      redirect("/admin/login");
    }
    throw error;
  }

  let data: DashboardData;
  try {
    data = await loadDashboardData();
  } catch {
    return (
      <Empty className="mt-12">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <HugeiconsIcon icon={Alert01Icon} strokeWidth={2} />
          </EmptyMedia>
          <EmptyTitle>Content is unreadable</EmptyTitle>
          <EmptyDescription>
            The dashboard couldn&apos;t read the content directory. Confirm{" "}
            <code>content/docs</code> exists and is readable, then reload this page.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  const { versions, docs } = data;
  const latestVersion = versions.find((version) => version.status === "latest") ?? null;
  const draftCount = docs.filter((doc) => doc.meta.draft).length;
  const deprecatedCount = docs.filter((doc) => doc.meta.deprecated).length;
  const stalest = findStalestDoc(docs);
  const healthIssues = buildHealthIssues(docs);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold text-foreground">Overview</h1>
        <p className="text-sm text-muted-foreground">Content health and version status at a glance.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard label="Total documents" value={docs.length} icon={File01Icon} />
        <StatCard label="Drafts" value={draftCount} icon={File02Icon} />
        <StatCard label="Deprecated pages" value={deprecatedCount} icon={Delete02Icon} />
        <StatCard label="Declared versions" value={versions.length} icon={Tag01Icon} />
        <StatCard label="Latest version" value={latestVersion?.label ?? "—"} icon={Tag01Icon} />
        <StatCard
          label="Stalest page"
          value={stalest !== null ? stalest.doc.meta.title : "—"}
          description={stalest !== null ? new Date(stalest.updatedAt).toLocaleDateString() : undefined}
          icon={Clock01Icon}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Content health</CardTitle>
          <CardDescription>
            {healthIssues.length === 0
              ? "No issues found across the documents currently on disk."
              : `${healthIssues.length} page${healthIssues.length === 1 ? "" : "s"} need attention.`}
          </CardDescription>
        </CardHeader>
        {healthIssues.length > 0 && (
          <CardContent>
            <ul className="flex flex-col divide-y divide-border">
              {healthIssues.map((issue) => (
                <li key={issue.key} className="flex items-center justify-between gap-4 py-3">
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <Link
                      href={issue.href}
                      className="truncate text-sm font-medium text-foreground underline-offset-2 hover:underline"
                    >
                      {issue.title}
                    </Link>
                    <span className="text-xs text-muted-foreground">
                      {issue.version} / {issue.slug}
                    </span>
                  </div>
                  <Badge variant="outline" className="shrink-0">
                    {issue.reason}
                  </Badge>
                </li>
              ))}
            </ul>
          </CardContent>
        )}
      </Card>
    </div>
  );
}
