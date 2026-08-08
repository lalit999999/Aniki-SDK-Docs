/**
 * Ingest payload validation and the two pure transforms that turn a raw
 * beacon into an `AnalyticsEvent`: path normalization and visitor hashing
 * (D6/D8).
 *
 * `hashVisitor` never touches disk: the per-day salt lives in an
 * in-memory `Map` for the lifetime of the process and is never persisted,
 * so uniques are countable within a day and individuals are not
 * re-identifiable across days (D6) - and, as a side effect, restarting the
 * process (a redeploy, a serverless cold start) rotates every salt, which
 * is the same "resets on cold start" caveat `MemoryAnalyticsStore` already
 * carries, not a new one.
 */

import { createHmac, randomBytes } from "node:crypto";

import { z } from "zod";

const MAX_PATH_LENGTH = 512;
const MAX_REFERRER_LENGTH = 2048;
const MAX_VERSION_ID_LENGTH = 64;

/**
 * Shape of the wire payload `POST /api/analytics` accepts (D8): the page
 * path, an optional documentation version id, and an optional referrer
 * URL. The visitor identifier is deliberately absent - the route derives
 * it server-side from `x-forwarded-for` and `user-agent`, never trusting a
 * client-supplied value.
 */
export const ingestEventPayloadSchema = z.object({
  path: z.string().min(1).max(MAX_PATH_LENGTH),
  versionId: z.string().min(1).max(MAX_VERSION_ID_LENGTH).optional(),
  referrer: z.string().max(MAX_REFERRER_LENGTH).optional(),
});

export type IngestEventPayload = z.infer<typeof ingestEventPayloadSchema>;

/**
 * Normalizes a raw path into the form stored as an `AnalyticsEvent.path`
 * and as a `DailyBucket.paths` key: strips any query string or fragment,
 * lowercases it, collapses a trailing slash (except the root path itself),
 * and caps its length so a pathologically long or malicious value can't
 * grow a day's file without bound.
 *
 * @example
 * ```ts
 * normalizePath("/Docs/Tools?utm_source=x#section"); // "/docs/tools"
 * normalizePath("/docs/tools/"); // "/docs/tools"
 * normalizePath("/"); // "/"
 * ```
 */
export function normalizePath(path: string): string {
  const withoutQueryOrHash = path.split(/[?#]/)[0] ?? path;
  const lower = withoutQueryOrHash.toLowerCase();
  const withLeadingSlash = lower.startsWith("/") ? lower : `/${lower}`;
  const collapsed =
    withLeadingSlash.length > 1 ? withLeadingSlash.replace(/\/+$/, "") || "/" : withLeadingSlash;
  return collapsed.slice(0, MAX_PATH_LENGTH);
}

/**
 * Extracts the hostname from a referrer URL, or `null` for direct traffic,
 * an unparseable value, or a same-origin referrer (not interesting to
 * report - every page view is already same-origin by definition).
 *
 * @example
 * ```ts
 * extractReferrerHost("https://www.google.com/search?q=x"); // "www.google.com"
 * extractReferrerHost(undefined); // null
 * extractReferrerHost("not a url"); // null
 * ```
 */
export function extractReferrerHost(referrer: string | undefined, siteUrl?: string): string | null {
  if (referrer === undefined || referrer.trim().length === 0) {
    return null;
  }
  try {
    const referrerHost = new URL(referrer).hostname;
    if (siteUrl !== undefined && referrerHost === new URL(siteUrl).hostname) {
      return null;
    }
    return referrerHost;
  } catch {
    return null;
  }
}

const dailySalts = new Map<string, string>();
const MAX_RETAINED_SALTS = 4;

function getDailySalt(date: string): string {
  const existing = dailySalts.get(date);
  if (existing !== undefined) {
    return existing;
  }

  const salt = randomBytes(32).toString("hex");
  dailySalts.set(date, salt);

  if (dailySalts.size > MAX_RETAINED_SALTS) {
    const oldest = [...dailySalts.keys()].sort()[0];
    if (oldest !== undefined) {
      dailySalts.delete(oldest);
    }
  }

  return salt;
}

/**
 * Derives a visitor hash from an IP address and user agent, salted per UTC
 * day (D6): `HMAC(dailySalt, ip + userAgent)`. The salt is generated on
 * first use for that date and lives only in this process's memory - never
 * written to disk, never derivable from the hash itself - so the same
 * visitor produces the same hash *within* a day (making uniques countable)
 * and an unrelated hash on every other day (making them not
 * re-identifiable across days).
 *
 * @example
 * ```ts
 * const a = hashVisitor("203.0.113.4", "Mozilla/5.0...", "2026-08-08");
 * const b = hashVisitor("203.0.113.4", "Mozilla/5.0...", "2026-08-08");
 * a === b; // true - same visitor, same day
 * ```
 */
export function hashVisitor(ip: string, userAgent: string, date: string): string {
  const salt = getDailySalt(date);
  return createHmac("sha256", salt).update(`${ip} ${userAgent}`).digest("hex");
}

/**
 * Clears the in-memory daily salt cache. Exists for tests that need two
 * calls on the same date to be treated as different days (or vice versa)
 * without waiting for the real calendar to turn over.
 *
 * @example
 * ```ts
 * afterEach(() => resetDailySaltsForTests());
 * ```
 */
export function resetDailySaltsForTests(): void {
  dailySalts.clear();
}
