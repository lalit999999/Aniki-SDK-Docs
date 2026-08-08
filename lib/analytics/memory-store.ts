/**
 * In-memory `AnalyticsStore` (D7): the automatic fallback when
 * `ANIKI_ANALYTICS_DIR` isn't writable (T10 - a serverless runtime's
 * filesystem is typically read-only), and the store the test suite uses so
 * a test never touches real disk.
 *
 * Reuses `FileAnalyticsStore`'s bucket helpers (`foldEventIntoStoredBucket`,
 * `createEmptyStoredBucket`, `toPublicDailyBucket`) so the two
 * implementations can never fold an event, or decide what counts as a new
 * unique, differently - the only thing that differs is where a bucket
 * lives between calls.
 *
 * No write queue: unlike the file store, a `record()` call here mutates a
 * plain in-memory object with no `await` between reading and writing it,
 * so JavaScript's single-threaded execution already makes each call
 * atomic with respect to every other - there is no interleaving window for
 * two concurrent calls to race in.
 */

import {
  createEmptyStoredBucket,
  foldEventIntoStoredBucket,
  toPublicDailyBucket,
  type StoredDailyBucket,
} from "./file-store";
import type { AnalyticsEvent, AnalyticsStore, AnalyticsStoreStatus, DailyBucket } from "./types";

const RETENTION_DAYS = 90;

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

export class MemoryAnalyticsStore implements AnalyticsStore {
  private readonly buckets = new Map<string, StoredDailyBucket>();

  private pruneOldBuckets(): void {
    if (this.buckets.size <= RETENTION_DAYS) {
      return;
    }
    const sortedDates = [...this.buckets.keys()].sort();
    while (this.buckets.size > RETENTION_DAYS) {
      const oldest = sortedDates.shift();
      if (oldest === undefined) {
        break;
      }
      this.buckets.delete(oldest);
    }
  }

  async record(event: AnalyticsEvent, visitorHash: string): Promise<void> {
    const date = event.timestamp.slice(0, 10);
    let bucket = this.buckets.get(date);
    if (bucket === undefined) {
      bucket = createEmptyStoredBucket(date);
      this.buckets.set(date, bucket);
      this.pruneOldBuckets();
    }
    foldEventIntoStoredBucket(bucket, event, visitorHash);
  }

  async readRange(days: number): Promise<readonly DailyBucket[]> {
    const dates = lastNDates(days, new Date());
    return dates.map((date) => toPublicDailyBucket(this.buckets.get(date) ?? createEmptyStoredBucket(date)));
  }

  describe(): AnalyticsStoreStatus {
    return { kind: "memory", message: "in-memory analytics store - data resets on cold start or restart" };
  }
}
