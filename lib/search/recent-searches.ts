/**
 * Pure recent-searches logic, kept separate from `hooks/use-recent-searches.ts`
 * so the storage-manipulation rules (cap, dedupe, ordering) are testable in
 * a plain node environment with a fake `Storage` object, with no React or
 * DOM involved.
 *
 * Every function here takes an explicit `Storage`-shaped argument rather
 * than reaching for `window.localStorage` itself, and every access is
 * wrapped: private-browsing quota errors and corrupt JSON both degrade to
 * an empty list or a silent no-op (D10) rather than throwing into a
 * render. A search palette losing its history because storage is
 * unavailable is an acceptable degradation; a crash is not.
 */

/** Versioned so a future change to the stored shape can be detected and
 * the old value discarded instead of misread. */
export const RECENT_SEARCHES_KEY = "aniki-docs:recent-searches:v1";
export const MAX_RECENT_SEARCHES = 5;
const MIN_QUERY_LENGTH = 2;

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

/**
 * Reads the stored recent-search list. Returns `[]` for a missing key,
 * corrupt JSON, a value that isn't a string array, or a `storage` that
 * throws (private browsing, disabled storage) - every failure mode
 * collapses to "no history" rather than propagating.
 *
 * @example
 * ```ts
 * readRecentSearches(window.localStorage); // ["streaming", "tools"]
 * ```
 */
export function readRecentSearches(storage: Storage): string[] {
  try {
    const raw = storage.getItem(RECENT_SEARCHES_KEY);
    if (raw === null) {
      return [];
    }
    const parsed: unknown = JSON.parse(raw);
    return isStringArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Persists `list` verbatim. A quota-exceeded or unavailable `storage`
 * silently drops the write rather than throwing.
 */
export function writeRecentSearches(storage: Storage, list: readonly string[]): void {
  try {
    storage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(list));
  } catch {
    // Storage unavailable or full - the write is lost, not fatal.
  }
}

/**
 * Returns a new list with `query` promoted to the front: trimmed, rejected
 * outright if blank or under 2 characters (not worth remembering),
 * deduplicated case-insensitively against the existing list, and capped
 * at `MAX_RECENT_SEARCHES`.
 *
 * @example
 * ```ts
 * addRecentSearch(["tools"], "Streaming"); // ["Streaming", "tools"]
 * addRecentSearch(["Streaming", "tools"], "streaming"); // ["streaming", "tools"]
 * ```
 */
export function addRecentSearch(list: readonly string[], query: string): string[] {
  const trimmed = query.trim();
  if (trimmed.length < MIN_QUERY_LENGTH) {
    return [...list];
  }

  const lower = trimmed.toLowerCase();
  const deduped = list.filter((item) => item.trim().toLowerCase() !== lower);

  return [trimmed, ...deduped].slice(0, MAX_RECENT_SEARCHES);
}

/**
 * Removes the stored recent-search list entirely. A storage failure is a
 * silent no-op, same as every other function here.
 */
export function clearRecentSearches(storage: Storage): void {
  try {
    storage.removeItem(RECENT_SEARCHES_KEY);
  } catch {
    // Storage unavailable - nothing to clear.
  }
}
