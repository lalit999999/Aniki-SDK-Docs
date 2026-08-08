/**
 * Public entry point for the first-party analytics system (D6): ingest
 * payload validation, path/visitor normalization, the storage interface
 * and its two implementations, store resolution, and aggregation.
 *
 * Not `server-only` as a whole: `aggregate.ts` and `types.ts` have no
 * filesystem dependency and are safe to import from a Client Component
 * (T9) - but `store.ts`, `file-store.ts`, and `memory-store.ts` each carry
 * their own `server-only` guard, so importing this barrel from client code
 * fails at build time the moment any of those are actually used, same as
 * every other `server-only`-guarded module in this codebase.
 *
 * @example
 * ```ts
 * import { resolveAnalyticsStore, summarize } from "@/lib/analytics";
 *
 * const store = await resolveAnalyticsStore();
 * const summary = summarize(await store.readRange(30), { days: 30 });
 * ```
 */

export { summarize } from "./aggregate";

export {
  AnalyticsError,
  AnalyticsStoreError,
  InvalidAnalyticsEventError,
} from "./errors";
export type { AnalyticsErrorCode } from "./errors";

export {
  extractReferrerHost,
  hashVisitor,
  ingestEventPayloadSchema,
  normalizePath,
  resetDailySaltsForTests,
} from "./event";
export type { IngestEventPayload } from "./event";

export {
  createEmptyStoredBucket,
  FileAnalyticsStore,
  foldEventIntoStoredBucket,
  toPublicDailyBucket,
} from "./file-store";
export type { StoredDailyBucket } from "./file-store";

export { MemoryAnalyticsStore } from "./memory-store";

export { getAnalyticsDirectory, resetAnalyticsStoreCache, resolveAnalyticsStore } from "./store";

export type {
  AnalyticsEvent,
  AnalyticsStore,
  AnalyticsStoreKind,
  AnalyticsStoreStatus,
  AnalyticsSummary,
  AnalyticsTimeSeriesPoint,
  AnalyticsTopPage,
  AnalyticsTopReferrer,
  AnalyticsVersionTotal,
  DailyBucket,
  PathCounters,
} from "./types";
