import { Analytics01Icon, EyeIcon, GlobalIcon, UserMultipleIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { ANALYTICS_RANGE_OPTIONS, parseRangeDays, RangeSelector } from "@/components/admin/analytics/range-selector";
import { StoreStatusCard } from "@/components/admin/analytics/store-status-card";
import { TopPagesTable, type TopPageRow } from "@/components/admin/analytics/top-pages-table";
import { TrafficChart } from "@/components/admin/analytics/traffic-chart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { requireVersionsAdmin, VersionsAdminUnauthorizedError } from "@/lib/admin/versions";
import { resolveAnalyticsStore, summarize } from "@/lib/analytics";
import { resolveDocsPath } from "@/lib/versions/route";

/** Reads cookies and the analytics store on every request. */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Analytics",
  robots: { index: false, follow: false },
};

/**
 * Maps an analytics path back to Prompt B's content editor route, when it
 * resolves to a documentation page - `null` for anything else (the
 * changelog, the home page). The route itself
 * (`/admin/content/<version>/<slug>`) doesn't exist on this branch; the
 * link is a dead 404 until the branches merge.
 */
function adminContentHrefForPath(pagePath: string): string | null {
  if (pagePath !== "/docs" && !pagePath.startsWith("/docs/")) {
    return null;
  }
  const segments = pagePath
    .replace(/^\/docs\/?/, "")
    .split("/")
    .filter((segment) => segment.length > 0);
  const resolved = resolveDocsPath(segments);
  if (resolved === null) {
    return null;
  }
  return `/admin/content/${resolved.versionId}/${resolved.docSlug ?? "index"}`;
}

/**
 * Analytics dashboard: a range selector, a store-status card (D7), summary
 * cards, a traffic chart, a top-pages table linking into Prompt B's
 * content editor, and a per-version breakdown. `requireVersionsAdmin()`
 * fails closed to `notFound()`, and a real empty state (`components/ui/empty`)
 * covers the honest first-run experience - a blank dashboard - so it
 * doesn't read as broken.
 */
export default async function AnalyticsAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string }>;
}) {
  try {
    await requireVersionsAdmin();
  } catch (error) {
    if (error instanceof VersionsAdminUnauthorizedError) {
      notFound();
    }
    throw error;
  }

  const { days: daysParam } = await searchParams;
  const days = parseRangeDays(daysParam);

  const store = await resolveAnalyticsStore();
  const buckets = await store.readRange(days);
  const summary = summarize(buckets, { days });
  const status = store.describe();

  const topPage = summary.topPages[0];
  const topReferrer = summary.topReferrers[0];
  const hasAnyData = summary.totalViews > 0;

  const topPageRows: TopPageRow[] = summary.topPages.map((page) => ({
    ...page,
    adminContentHref: adminContentHrefForPath(page.path),
  }));

  return (
    <div className="mx-auto w-full max-w-5xl flex-1 px-4 py-12 sm:px-6 lg:px-8">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-heading text-3xl font-bold tracking-tight text-foreground">Analytics</h1>
          <p className="mt-2 text-muted-foreground">
            First-party, privacy-preserving traffic for the last {days} days.
          </p>
        </div>
        <RangeSelector selected={days} />
      </div>

      <StoreStatusCard status={status} />

      {!hasAnyData ? (
        <Empty className="mt-8">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <HugeiconsIcon icon={Analytics01Icon as IconSvgElement} strokeWidth={2} />
            </EmptyMedia>
            <EmptyTitle>No traffic recorded yet</EmptyTitle>
            <EmptyDescription>
              Once visitors browse the docs or changelog, views and uniques will show up here. Try a wider range (
              {ANALYTICS_RANGE_OPTIONS.join("d / ")}
              d) if the site is new.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <>
          <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <SummaryCard icon={EyeIcon as IconSvgElement} label="Total views" value={summary.totalViews.toLocaleString()} />
            <SummaryCard
              icon={UserMultipleIcon as IconSvgElement}
              label="Unique visitors"
              value={summary.totalUniques.toLocaleString()}
            />
            <SummaryCard icon={Analytics01Icon as IconSvgElement} label="Top page" value={topPage?.path ?? "-"} />
            <SummaryCard
              icon={GlobalIcon as IconSvgElement}
              label="Top referrer"
              value={topReferrer?.referrerHost ?? "Direct"}
            />
          </div>

          <Card className="mt-8">
            <CardHeader>
              <CardTitle>Traffic over time</CardTitle>
            </CardHeader>
            <CardContent>
              <TrafficChart timeSeries={summary.timeSeries} />
            </CardContent>
          </Card>

          <Card className="mt-8">
            <CardHeader>
              <CardTitle>Top pages</CardTitle>
            </CardHeader>
            <CardContent>
              <TopPagesTable pages={topPageRows} />
            </CardContent>
          </Card>

          {summary.perVersion.length > 0 ? (
            <Card className="mt-8">
              <CardHeader>
                <CardTitle>Views per documentation version</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="flex flex-col gap-2">
                  {summary.perVersion.map((version) => (
                    <li key={version.versionId} className="flex items-center justify-between text-sm">
                      <span className="font-medium text-foreground">{version.versionId}</span>
                      <span className="text-muted-foreground">{version.views.toLocaleString()} views</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ) : null}
        </>
      )}
    </div>
  );
}

function SummaryCard({ icon, label, value }: { icon: IconSvgElement; label: string; value: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <HugeiconsIcon icon={icon} strokeWidth={2} className="size-4" />
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="truncate text-2xl font-semibold text-foreground">{value}</p>
      </CardContent>
    </Card>
  );
}
