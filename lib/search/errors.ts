/**
 * Error taxonomy for the client-side search system.
 *
 * Every failure path in `lib/search` throws one of the concrete classes
 * below rather than a bare `Error`, matching `lib/content/errors.ts`. A
 * single `error instanceof SearchError` check catches all of them, while
 * `error.code` lets a caller branch on the specific failure without
 * string-matching a message.
 */

/**
 * Discriminant for every error this module can throw. Kept as a union
 * (rather than deriving it from the class list) so it can be imported
 * without pulling in the classes themselves.
 */
export type SearchErrorCode =
  | "SEARCH_INDEX_FETCH_ERROR"
  | "SEARCH_INDEX_PARSE_ERROR"
  | "SEARCH_INDEX_VERSION_ERROR"
  | "RECENT_SEARCHES_STORAGE_ERROR";

/**
 * Base class for every error the search system throws. Not thrown
 * directly - use one of the concrete subclasses below.
 *
 * @example
 * ```ts
 * try {
 *   await loadSearchIndex();
 * } catch (error) {
 *   if (error instanceof SearchError) {
 *     console.error(error.code, error.context);
 *   }
 * }
 * ```
 */
export abstract class SearchError extends Error {
  abstract readonly code: SearchErrorCode;
  readonly context: Readonly<Record<string, unknown>>;

  constructor(
    message: string,
    options?: { context?: Record<string, unknown>; cause?: unknown },
  ) {
    super(message, options?.cause !== undefined ? { cause: options.cause } : undefined);
    this.name = this.constructor.name;
    this.context = Object.freeze({ ...(options?.context ?? {}) });
  }

  /**
   * Plain-object representation suitable for logging or serializing over
   * a boundary (error tracker, aria-live message) that doesn't understand
   * `Error` instances.
   */
  toJSON(): { name: string; code: SearchErrorCode; message: string; context: Readonly<Record<string, unknown>> } {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      context: this.context,
    };
  }
}

/**
 * Thrown when fetching `/api/search-index` fails at the network level or
 * returns a non-OK response.
 *
 * @example
 * ```ts
 * throw new SearchIndexFetchError("search index request failed", {
 *   status: 503,
 * });
 * ```
 */
export class SearchIndexFetchError extends SearchError {
  readonly code = "SEARCH_INDEX_FETCH_ERROR" as const;

  constructor(message: string, context: { status?: number }, cause?: unknown) {
    super(message, { context, cause });
  }
}

/**
 * Thrown when the search index response body isn't valid JSON, or is
 * valid JSON that doesn't satisfy the `isSearchIndex` type guard.
 *
 * @example
 * ```ts
 * throw new SearchIndexParseError("search index response was not valid JSON");
 * ```
 */
export class SearchIndexParseError extends SearchError {
  readonly code = "SEARCH_INDEX_PARSE_ERROR" as const;

  constructor(message: string, context?: Record<string, unknown>, cause?: unknown) {
    super(message, { context, cause });
  }
}

/**
 * Thrown when the fetched index's `version` doesn't match the client's
 * `SEARCH_INDEX_VERSION` - a stale CDN response or an in-flight deploy
 * serving mismatched build artifacts.
 *
 * @example
 * ```ts
 * throw new SearchIndexVersionError("search index version mismatch", {
 *   expected: 1,
 *   received: 2,
 * });
 * ```
 */
export class SearchIndexVersionError extends SearchError {
  readonly code = "SEARCH_INDEX_VERSION_ERROR" as const;

  constructor(message: string, context: { expected: number; received: number }) {
    super(message, { context });
  }
}

/**
 * Thrown when `localStorage` is unavailable (private browsing, quota
 * exceeded) or contains corrupt JSON for the recent-searches key. Callers
 * catch this and degrade to an empty in-memory list rather than letting it
 * propagate into a render.
 *
 * @example
 * ```ts
 * throw new RecentSearchesStorageError("failed to read recent searches", {
 *   key: RECENT_SEARCHES_KEY,
 * });
 * ```
 */
export class RecentSearchesStorageError extends SearchError {
  readonly code = "RECENT_SEARCHES_STORAGE_ERROR" as const;

  constructor(message: string, context: { key: string }, cause?: unknown) {
    super(message, { context, cause });
  }
}
