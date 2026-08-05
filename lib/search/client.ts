/**
 * Client-side loading of the prebuilt search index.
 *
 * Isomorphic (no `server-only`, no Node builtins) so it can be imported
 * from the search dialog directly. Validation is a hand-rolled type guard
 * rather than zod (D6): zod is already a dependency but is used
 * server-side only today, and pulling it into the client bundle for one
 * shape check we fully control end-to-end isn't worth the ~12 KB gzipped.
 */

import { DOC_CATEGORIES } from "@/lib/content/types";
import type { DocCategory } from "@/lib/content/types";

import { SearchIndexFetchError, SearchIndexParseError, SearchIndexVersionError } from "./errors";
import { SEARCH_INDEX_VERSION } from "./types";
import type { SearchIndex, SearchSection } from "./types";

/** Path the search index is served from - see `app/api/search-index/route.ts`. */
export const SEARCH_INDEX_URL = "/api/search-index";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isDocCategory(value: unknown): value is DocCategory {
  return typeof value === "string" && (DOC_CATEGORIES as readonly string[]).includes(value);
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}

function isHeadingLevel(value: unknown): value is 2 | 3 | 4 | null {
  return value === null || value === 2 || value === 3 || value === 4;
}

function isSearchSection(value: unknown): value is SearchSection {
  if (!isRecord(value)) {
    return false;
  }
  return (
    typeof value.id === "string" &&
    typeof value.docSlug === "string" &&
    typeof value.docTitle === "string" &&
    typeof value.docDescription === "string" &&
    isDocCategory(value.category) &&
    typeof value.route === "string" &&
    typeof value.href === "string" &&
    isNullableString(value.headingId) &&
    isNullableString(value.headingText) &&
    isHeadingLevel(value.headingLevel) &&
    typeof value.content === "string" &&
    typeof value.order === "number"
  );
}

/**
 * Total type guard for a fetched search index response. Deliberately
 * checks every field rather than trusting the response shape - a stale
 * CDN edge, a partial deploy, or a future schema change should surface as
 * a clear `SearchIndexParseError`, not a runtime crash deep inside the
 * scorer.
 *
 * @example
 * ```ts
 * const body: unknown = await response.json();
 * if (!isSearchIndex(body)) throw new SearchIndexParseError("bad shape");
 * ```
 */
export function isSearchIndex(value: unknown): value is SearchIndex {
  if (!isRecord(value)) {
    return false;
  }
  if (typeof value.version !== "number" || typeof value.generatedAt !== "string") {
    return false;
  }
  return Array.isArray(value.sections) && value.sections.every(isSearchSection);
}

let inFlight: Promise<SearchIndex> | null = null;

async function fetchAndValidate(signal?: AbortSignal): Promise<SearchIndex> {
  let response: Response;
  try {
    response = await fetch(SEARCH_INDEX_URL, { signal });
  } catch (error: unknown) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw error;
    }
    throw new SearchIndexFetchError("failed to fetch the search index", {}, error);
  }

  if (!response.ok) {
    throw new SearchIndexFetchError(`search index request failed with status ${response.status}`, {
      status: response.status,
    });
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch (error: unknown) {
    throw new SearchIndexParseError("search index response was not valid JSON", undefined, error);
  }

  if (!isSearchIndex(body)) {
    throw new SearchIndexParseError("search index response did not match the expected shape");
  }

  if (body.version !== SEARCH_INDEX_VERSION) {
    throw new SearchIndexVersionError("search index version mismatch", {
      expected: SEARCH_INDEX_VERSION,
      received: body.version,
    });
  }

  return body;
}

/**
 * Fetches and validates the search index, memoizing the in-flight request
 * at module scope so rapid open/close cycles of the search palette issue
 * exactly one network request rather than one per open. The memo is
 * cleared on failure so a transient network error is retryable on the
 * next call instead of permanently caching a rejection.
 *
 * An `AbortError` (the caller's `signal` firing, e.g. the dialog closing
 * mid-fetch) propagates as-is rather than being wrapped into
 * `SearchIndexFetchError`, so callers can distinguish "the user cancelled
 * this" from "the network failed."
 *
 * @example
 * ```ts
 * const index = await loadSearchIndex();
 * const engine = createSearchEngine(index);
 * ```
 */
export function loadSearchIndex(signal?: AbortSignal): Promise<SearchIndex> {
  if (inFlight === null) {
    inFlight = fetchAndValidate(signal).catch((error: unknown) => {
      inFlight = null;
      throw error;
    });
  }
  return inFlight;
}
