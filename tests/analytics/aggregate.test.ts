/**
 * Exercises `summarize` as the pure function it's documented to be: no
 * store, no filesystem, just `DailyBucket[]` in and `AnalyticsSummary` out.
 * `referenceDate` pins "now" so the zero-filled date range is deterministic
 * without needing fake timers.
 */
import { describe, expect, it } from "vitest";

import { summarize } from "@/lib/analytics/aggregate";
import type { DailyBucket } from "@/lib/analytics/types";

const REFERENCE_DATE = new Date("2026-08-08T12:00:00.000Z");

function bucket(overrides: Partial<DailyBucket> & { date: string }): DailyBucket {
  return { paths: {}, referrers: {}, versions: {}, ...overrides };
}

describe("summarize", () => {
  it("handles an empty range without throwing or dividing by zero", () => {
    const summary = summarize([], { days: 7, referenceDate: REFERENCE_DATE });

    expect(summary.days).toBe(7);
    expect(summary.totalViews).toBe(0);
    expect(summary.totalUniques).toBe(0);
    expect(summary.timeSeries).toHaveLength(7);
    expect(summary.timeSeries.every((point) => point.views === 0 && point.uniques === 0)).toBe(true);
    expect(summary.topPages).toEqual([]);
    expect(summary.topReferrers).toEqual([]);
    expect(summary.perVersion).toEqual([]);
  });

  it("zero-fills a day with no matching bucket", () => {
    const summary = summarize(
      [bucket({ date: "2026-08-08", paths: { "/docs/tools": { views: 5, uniques: 3 } } })],
      { days: 3, referenceDate: REFERENCE_DATE },
    );

    expect(summary.timeSeries.map((p) => p.date)).toEqual(["2026-08-06", "2026-08-07", "2026-08-08"]);
    expect(summary.timeSeries[0]).toEqual({ date: "2026-08-06", views: 0, uniques: 0 });
    expect(summary.timeSeries[2]).toEqual({ date: "2026-08-08", views: 5, uniques: 3 });
  });

  it("ignores a bucket whose date falls outside the requested window", () => {
    const summary = summarize(
      [
        bucket({ date: "2020-01-01", paths: { "/docs/old": { views: 100, uniques: 100 } } }),
        bucket({ date: "2026-08-08", paths: { "/docs/tools": { views: 5, uniques: 3 } } }),
      ],
      { days: 1, referenceDate: REFERENCE_DATE },
    );

    expect(summary.totalViews).toBe(5);
    expect(summary.topPages).toEqual([{ path: "/docs/tools", views: 5, uniques: 3 }]);
  });

  it("sums totals across multiple days", () => {
    const summary = summarize(
      [
        bucket({ date: "2026-08-07", paths: { "/docs/tools": { views: 2, uniques: 2 } } }),
        bucket({ date: "2026-08-08", paths: { "/docs/tools": { views: 3, uniques: 1 } } }),
      ],
      { days: 2, referenceDate: REFERENCE_DATE },
    );

    expect(summary.totalViews).toBe(5);
    expect(summary.totalUniques).toBe(3);
  });

  it("ranks topPages by views descending and caps at 10", () => {
    const paths: DailyBucket["paths"] = {};
    for (let i = 0; i < 15; i++) {
      paths[`/docs/page-${i}`] = { views: i + 1, uniques: 1 };
    }
    const summary = summarize([bucket({ date: "2026-08-08", paths })], { days: 1, referenceDate: REFERENCE_DATE });

    expect(summary.topPages).toHaveLength(10);
    expect(summary.topPages[0]?.path).toBe("/docs/page-14");
    expect(summary.topPages[0]?.views).toBe(15);
  });

  it("ranks topReferrers by views descending and caps at 10", () => {
    const referrers: DailyBucket["referrers"] = {};
    for (let i = 0; i < 12; i++) {
      referrers[`ref-${i}.example.com`] = i + 1;
    }
    const summary = summarize([bucket({ date: "2026-08-08", referrers })], {
      days: 1,
      referenceDate: REFERENCE_DATE,
    });

    expect(summary.topReferrers).toHaveLength(10);
    expect(summary.topReferrers[0]?.referrerHost).toBe("ref-11.example.com");
  });

  it("sums perVersion totals across days and sorts descending", () => {
    const summary = summarize(
      [
        bucket({ date: "2026-08-07", versions: { v1: 3, v2: 1 } }),
        bucket({ date: "2026-08-08", versions: { v1: 1, v2: 5 } }),
      ],
      { days: 2, referenceDate: REFERENCE_DATE },
    );

    expect(summary.perVersion).toEqual([
      { versionId: "v2", views: 6 },
      { versionId: "v1", views: 4 },
    ]);
  });

  it("aggregates the same page's counts across multiple days into one topPages entry", () => {
    const summary = summarize(
      [
        bucket({ date: "2026-08-07", paths: { "/docs/tools": { views: 2, uniques: 2 } } }),
        bucket({ date: "2026-08-08", paths: { "/docs/tools": { views: 3, uniques: 3 } } }),
      ],
      { days: 2, referenceDate: REFERENCE_DATE },
    );

    expect(summary.topPages).toEqual([{ path: "/docs/tools", views: 5, uniques: 5 }]);
  });
});
