/**
 * Pure aggregation over `DailyBucket`s (no I/O, fully testable): totals,
 * a zero-filled per-day time series, top pages, top referrers, and
 * per-version totals for the `/admin/analytics` dashboard.
 */

import type {
  AnalyticsSummary,
  AnalyticsTimeSeriesPoint,
  AnalyticsTopPage,
  AnalyticsTopReferrer,
  AnalyticsVersionTotal,
  DailyBucket,
} from "./types";

const TOP_N = 10;

function lastNDates(days: number, referenceDate: Date): string[] {
  const dates: string[] = [];
  for (let offset = days - 1; offset >= 0; offset--) {
    const d = new Date(
      Date.UTC(referenceDate.getUTCFullYear(), referenceDate.getUTCMonth(), referenceDate.getUTCDate() - offset),
    );
    dates.push(d.toISOString().slice(0, 10));
  }
  return dates;
}

/**
 * Summarizes a window of `DailyBucket`s into everything the analytics
 * dashboard renders. Self-contained about the date range: it generates its
 * own trailing `options.days`-day window ending "now" (or `referenceDate`,
 * for deterministic tests) rather than trusting `buckets` to already cover
 * exactly that range, so a bucket outside the window is ignored and a
 * missing day inside it is zero-filled - `timeSeries` therefore always has
 * exactly `options.days` entries, and an empty `buckets` array degrades to
 * an all-zero summary rather than throwing or dividing by anything.
 *
 * @example
 * ```ts
 * const summary = summarize(buckets, { days: 30 });
 * summary.timeSeries.length; // 30
 * summary.totalViews; // 0 if `buckets` is []
 * ```
 */
export function summarize(
  buckets: readonly DailyBucket[],
  options: { days: number; referenceDate?: Date },
): AnalyticsSummary {
  const dateRange = lastNDates(options.days, options.referenceDate ?? new Date());
  const bucketsByDate = new Map(buckets.map((bucket) => [bucket.date, bucket]));

  let totalViews = 0;
  let totalUniques = 0;
  const pageTotals = new Map<string, AnalyticsTopPage>();
  const referrerTotals = new Map<string, number>();
  const versionTotals = new Map<string, number>();
  const timeSeries: AnalyticsTimeSeriesPoint[] = [];

  for (const date of dateRange) {
    const bucket = bucketsByDate.get(date);
    let dayViews = 0;
    let dayUniques = 0;

    if (bucket !== undefined) {
      for (const [pagePath, counters] of Object.entries(bucket.paths)) {
        dayViews += counters.views;
        dayUniques += counters.uniques;

        const existing = pageTotals.get(pagePath) ?? { path: pagePath, views: 0, uniques: 0 };
        existing.views += counters.views;
        existing.uniques += counters.uniques;
        pageTotals.set(pagePath, existing);
      }

      for (const [referrerHost, count] of Object.entries(bucket.referrers)) {
        referrerTotals.set(referrerHost, (referrerTotals.get(referrerHost) ?? 0) + count);
      }

      for (const [versionId, count] of Object.entries(bucket.versions)) {
        versionTotals.set(versionId, (versionTotals.get(versionId) ?? 0) + count);
      }
    }

    timeSeries.push({ date, views: dayViews, uniques: dayUniques });
    totalViews += dayViews;
    totalUniques += dayUniques;
  }

  const topPages: AnalyticsTopPage[] = [...pageTotals.values()].sort((a, b) => b.views - a.views).slice(0, TOP_N);

  const topReferrers: AnalyticsTopReferrer[] = [...referrerTotals.entries()]
    .map(([referrerHost, views]) => ({ referrerHost, views }))
    .sort((a, b) => b.views - a.views)
    .slice(0, TOP_N);

  const perVersion: AnalyticsVersionTotal[] = [...versionTotals.entries()]
    .map(([versionId, views]) => ({ versionId, views }))
    .sort((a, b) => b.views - a.views);

  return {
    days: options.days,
    totalViews,
    totalUniques,
    timeSeries,
    topPages,
    topReferrers,
    perVersion,
  };
}
