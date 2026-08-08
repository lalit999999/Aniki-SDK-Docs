/**
 * Error taxonomy for the analytics store. Mirrors the shape used
 * throughout `lib/versions`, `lib/seo`, and `lib/admin/versions` (a `code`
 * discriminant, a frozen `context`, a `toJSON()`).
 *
 * Deliberately small: per D8/D6 (in the sub-task 9 spec), a failure to
 * record or read analytics must never break a page render or a beacon
 * request. Callers at the boundary (the ingest route, the dashboard page)
 * catch these and degrade - count the failure, show an empty state -
 * rather than let them propagate.
 */

/** Discriminant for every error this module can throw. */
export type AnalyticsErrorCode = "ANALYTICS_STORE_ERROR" | "INVALID_ANALYTICS_EVENT";

/**
 * Base class for every error `lib/analytics` throws. Not thrown directly -
 * use one of the concrete subclasses below.
 */
export abstract class AnalyticsError extends Error {
  abstract readonly code: AnalyticsErrorCode;
  readonly context: Readonly<Record<string, unknown>>;

  constructor(message: string, context?: Record<string, unknown>) {
    super(message);
    this.name = this.constructor.name;
    this.context = Object.freeze({ ...(context ?? {}) });
  }

  /**
   * Plain-object representation suitable for logging or serializing over a
   * boundary that doesn't understand `Error` instances.
   */
  toJSON(): { name: string; code: AnalyticsErrorCode; message: string; context: Readonly<Record<string, unknown>> } {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      context: this.context,
    };
  }
}

/**
 * Thrown by a store implementation when an operation fails for a reason
 * other than "the directory isn't writable" (which `resolveAnalyticsStore`
 * treats as an ordinary fallback signal, not an error, per D7). In
 * practice this is rare: `FileAnalyticsStore` is built to skip a corrupt
 * or unreadable day's file rather than throw, so callers mostly won't see
 * this - it exists for failures a caller genuinely needs to distinguish
 * from "no data for this range yet".
 *
 * @example
 * ```ts
 * throw new AnalyticsStoreError("failed to prune old analytics files", {
 *   directory: "/repo/.aniki-analytics",
 * });
 * ```
 */
export class AnalyticsStoreError extends AnalyticsError {
  readonly code = "ANALYTICS_STORE_ERROR" as const;

  constructor(message: string, context: { directory: string }, cause?: unknown) {
    super(message, context);
    if (cause !== undefined) {
      this.cause = cause;
    }
  }
}

/**
 * Thrown by `parseIngestPayload` (in `event.ts`) when a caller opts into
 * the throwing form rather than its `safeParse`-style non-throwing
 * counterpart. The ingest route itself never throws this - it drops an
 * invalid event silently and still returns `204` (D8) - but the schema is
 * reused directly by tests that want to assert *why* a payload was
 * rejected.
 *
 * @example
 * ```ts
 * throw new InvalidAnalyticsEventError("invalid analytics ingest payload", {
 *   issues: ["path: Required"],
 * });
 * ```
 */
export class InvalidAnalyticsEventError extends AnalyticsError {
  readonly code = "INVALID_ANALYTICS_EVENT" as const;

  constructor(message: string, context: { issues: readonly string[] }) {
    super(message, context);
  }
}
