/**
 * Type definitions for the first-party analytics system (D6): a single
 * ingested event, the per-day aggregate a store persists, the summary a
 * dashboard renders, and the storage interface two implementations
 * (`FileAnalyticsStore`, `MemoryAnalyticsStore`) satisfy.
 *
 * No filesystem access, no `server-only` - pure data shapes shared by
 * `event.ts`, `aggregate.ts`, both store implementations, and the
 * `/admin/analytics` dashboard.
 */

/** A single page view, normalized and ready to fold into a `DailyBucket`.
 * Never carries an IP address, a raw visitor identifier, or a cookie - only
 * what `hashVisitor` (in `event.ts`) and the store need (D6). */
export interface AnalyticsEvent {
  /** Normalized site-relative path (`normalizePath` in `event.ts`). */
  path: string;
  /** Documentation version the page belongs to, or `null` for a page
   * outside `/docs` (e.g. the changelog). Supplied directly by the page
   * that fires the beacon, since the version isn't always recoverable
   * from an unprefixed latest-version URL alone (T4/T8). */
  versionId: string | null;
  /** Hostname of the referring page, or `null` for direct/no-referrer
   * traffic. Never the full referrer URL - a path or query string on the
   * referrer can itself be identifying. */
  referrerHost: string | null;
  /** ISO 8601 timestamp the event was recorded, stamped server-side. */
  timestamp: string;
}

/** View/unique counters for a single path on a single day. */
export interface PathCounters {
  views: number;
  uniques: number;
}

/**
 * One UTC day's aggregate: per-path view/unique counters, per-referrer-host
 * counts, and per-version view counts. This is the public shape a store
 * returns from `readRange` - never the visitor-hash bookkeeping a store
 * implementation needs internally to compute `uniques` (D6: hashes never
 * leave the store layer).
 */
export interface DailyBucket {
  /** UTC calendar date, `YYYY-MM-DD`. */
  date: string;
  paths: Record<string, PathCounters>;
  referrers: Record<string, number>;
  versions: Record<string, number>;
}

/** A single day's point in `AnalyticsSummary.timeSeries`. */
export interface AnalyticsTimeSeriesPoint {
  date: string;
  views: number;
  uniques: number;
}

/** A single page's totals in `AnalyticsSummary.topPages`. */
export interface AnalyticsTopPage extends PathCounters {
  path: string;
}

/** A single referrer host's totals in `AnalyticsSummary.topReferrers`. */
export interface AnalyticsTopReferrer {
  referrerHost: string;
  views: number;
}

/** A single version's totals in `AnalyticsSummary.perVersion`. */
export interface AnalyticsVersionTotal {
  versionId: string;
  views: number;
}

/**
 * The aggregate `summarize` (in `aggregate.ts`) produces over a window of
 * `DailyBucket`s - everything the `/admin/analytics` dashboard renders.
 */
export interface AnalyticsSummary {
  /** Size of the requested window, e.g. `30`. `timeSeries` always has
   * exactly this many entries, zero-filled for days with no data, so a
   * chart never has to special-case a gap. */
  days: number;
  totalViews: number;
  totalUniques: number;
  timeSeries: readonly AnalyticsTimeSeriesPoint[];
  /** Sorted by `views` descending, capped to the top 10. */
  topPages: readonly AnalyticsTopPage[];
  /** Sorted by `views` descending, capped to the top 10. */
  topReferrers: readonly AnalyticsTopReferrer[];
  /** Sorted by `views` descending. */
  perVersion: readonly AnalyticsVersionTotal[];
}

/** Which `AnalyticsStore` implementation is active. */
export type AnalyticsStoreKind = "file" | "memory";

/** What `AnalyticsStore.describe()` reports, for the dashboard's status
 * card (D7) - e.g. so a Vercel deploy shows "in-memory, resets on cold
 * start" rather than silently recording nothing. */
export interface AnalyticsStoreStatus {
  kind: AnalyticsStoreKind;
  message: string;
}

/**
 * Storage interface for analytics events, satisfied by `FileAnalyticsStore`
 * (default, JSON-per-day under `ANIKI_ANALYTICS_DIR`) and
 * `MemoryAnalyticsStore` (automatic fallback when the directory is
 * unwritable - T10 - and the store tests use) (D7).
 */
export interface AnalyticsStore {
  /**
   * Folds one event into its UTC day's bucket. `visitorHash` is computed by
   * the caller (`hashVisitor` in `event.ts`) - the store never sees an IP
   * address or a raw visitor identifier, only the day's already-hashed
   * value, used solely to decide whether this is a new unique for that
   * path today.
   */
  record(event: AnalyticsEvent, visitorHash: string): Promise<void>;
  /** The last `days` UTC days' buckets, oldest first. Never throws for a
   * missing or corrupt day - that day is simply absent from the result. */
  readRange(days: number): Promise<readonly DailyBucket[]>;
  /** Which implementation is active and why, for the dashboard's status
   * card (D7). */
  describe(): AnalyticsStoreStatus;
}
