/**
 * File-backed `AnalyticsStore` (D7): one JSON file per UTC day under
 * `ANIKI_ANALYTICS_DIR`, written atomically (temp file + `rename`) and
 * serialized per file through an in-process write queue so concurrent
 * requests can't interleave a read-modify-write and lose an event.
 *
 * The on-disk shape (`StoredDailyBucket`) is a superset of the public
 * `DailyBucket`: it also carries the visitor-hash bookkeeping needed to
 * compute `uniques` correctly across restarts, which never leaves this
 * module (D6) - `toPublicDailyBucket` strips it before a bucket is
 * returned from `readRange`. `MemoryAnalyticsStore` reuses these same
 * helpers so the two implementations can never fold an event differently.
 */

import "server-only";

import { mkdir, readdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import path from "node:path";

import type { AnalyticsEvent, AnalyticsStore, AnalyticsStoreStatus, DailyBucket } from "./types";

const RETENTION_DAYS = 90;
const DATE_FILE_PATTERN = /^(\d{4}-\d{2}-\d{2})\.json$/;

/** The on-disk shape of a single day's file: a `DailyBucket` plus the
 * per-path visitor-hash lists used to dedupe `uniques`. */
export interface StoredDailyBucket extends DailyBucket {
  visitorHashesByPath: Record<string, string[]>;
}

/** A fresh, empty bucket for a UTC date. */
export function createEmptyStoredBucket(date: string): StoredDailyBucket {
  return { date, paths: {}, referrers: {}, versions: {}, visitorHashesByPath: {} };
}

/**
 * Folds one event into a stored bucket in place: increments the path's
 * view count always, its unique count only the first time `visitorHash` is
 * seen for that path on this day, and the referrer/version counters when
 * present.
 */
export function foldEventIntoStoredBucket(bucket: StoredDailyBucket, event: AnalyticsEvent, visitorHash: string): void {
  const counters = bucket.paths[event.path] ?? { views: 0, uniques: 0 };
  counters.views += 1;

  const seen = bucket.visitorHashesByPath[event.path] ?? [];
  if (!seen.includes(visitorHash)) {
    seen.push(visitorHash);
    counters.uniques += 1;
  }
  bucket.paths[event.path] = counters;
  bucket.visitorHashesByPath[event.path] = seen;

  if (event.referrerHost !== null) {
    bucket.referrers[event.referrerHost] = (bucket.referrers[event.referrerHost] ?? 0) + 1;
  }
  if (event.versionId !== null) {
    bucket.versions[event.versionId] = (bucket.versions[event.versionId] ?? 0) + 1;
  }
}

/** Strips the visitor-hash bookkeeping a store keeps internally, leaving
 * only the public `DailyBucket` shape. */
export function toPublicDailyBucket(stored: StoredDailyBucket): DailyBucket {
  return { date: stored.date, paths: stored.paths, referrers: stored.referrers, versions: stored.versions };
}

function isStoredDailyBucketShape(value: unknown): value is StoredDailyBucket {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const record = value as Record<string, unknown>;
  return (
    typeof record.date === "string" &&
    typeof record.paths === "object" &&
    record.paths !== null &&
    typeof record.referrers === "object" &&
    record.referrers !== null &&
    typeof record.versions === "object" &&
    record.versions !== null &&
    typeof record.visitorHashesByPath === "object" &&
    record.visitorHashesByPath !== null
  );
}

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

export class FileAnalyticsStore implements AnalyticsStore {
  private readonly directory: string;
  private readonly writeQueues = new Map<string, Promise<void>>();

  constructor(directory: string) {
    this.directory = directory;
  }

  private filePath(date: string): string {
    return path.join(this.directory, `${date}.json`);
  }

  private enqueue<T>(key: string, task: () => Promise<T>): Promise<T> {
    const previous = this.writeQueues.get(key) ?? Promise.resolve();
    const settleAndRun = previous.then(task, task);
    this.writeQueues.set(
      key,
      settleAndRun.then(
        () => undefined,
        () => undefined,
      ),
    );
    return settleAndRun;
  }

  private async readStoredBucket(date: string): Promise<StoredDailyBucket> {
    let raw: string;
    try {
      raw = await readFile(this.filePath(date), "utf-8");
    } catch {
      return createEmptyStoredBucket(date);
    }

    try {
      const parsed: unknown = JSON.parse(raw);
      if (isStoredDailyBucketShape(parsed)) {
        return parsed;
      }
    } catch {
      // Corrupt JSON is treated the same as "no file yet" - skipped, not
      // fatal, per the store's contract.
    }
    return createEmptyStoredBucket(date);
  }

  private async writeStoredBucket(bucket: StoredDailyBucket): Promise<void> {
    await mkdir(this.directory, { recursive: true });
    const finalPath = this.filePath(bucket.date);
    const tempPath = path.join(this.directory, `.${bucket.date}.${randomBytes(4).toString("hex")}.tmp`);
    await writeFile(tempPath, JSON.stringify(bucket), "utf-8");
    await rename(tempPath, finalPath);
  }

  private async pruneOldFiles(referenceDate: Date): Promise<void> {
    let entries: string[];
    try {
      entries = await readdir(this.directory);
    } catch {
      return;
    }

    const cutoff = new Date(
      Date.UTC(referenceDate.getUTCFullYear(), referenceDate.getUTCMonth(), referenceDate.getUTCDate() - RETENTION_DAYS),
    )
      .toISOString()
      .slice(0, 10);

    await Promise.all(
      entries.map(async (entry) => {
        const match = DATE_FILE_PATTERN.exec(entry);
        if (match === null) {
          return;
        }
        const [, date] = match;
        if (date !== undefined && date < cutoff) {
          await rm(path.join(this.directory, entry), { force: true }).catch(() => undefined);
        }
      }),
    );
  }

  async record(event: AnalyticsEvent, visitorHash: string): Promise<void> {
    const date = event.timestamp.slice(0, 10);
    await this.enqueue(date, async () => {
      const bucket = await this.readStoredBucket(date);
      foldEventIntoStoredBucket(bucket, event, visitorHash);
      await this.writeStoredBucket(bucket);
    });
    await this.pruneOldFiles(new Date(event.timestamp)).catch(() => undefined);
  }

  async readRange(days: number): Promise<readonly DailyBucket[]> {
    const dates = lastNDates(days, new Date());
    const buckets = await Promise.all(
      dates.map(async (date) => {
        const raw = await this.readStoredBucket(date).catch(() => createEmptyStoredBucket(date));
        return toPublicDailyBucket(raw);
      }),
    );
    return buckets;
  }

  describe(): AnalyticsStoreStatus {
    return { kind: "file", message: `file-backed analytics under ${this.directory}` };
  }
}
