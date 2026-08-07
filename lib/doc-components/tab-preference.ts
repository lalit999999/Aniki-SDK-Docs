/**
 * Pure persistence logic for a `sync`-keyed tab group's selected label,
 * mirroring `lib/search/recent-searches.ts` exactly (D12): every function
 * takes an explicit `Storage`-shaped argument instead of reaching for
 * `window.localStorage`, and every access is try/caught so a private-
 * browsing quota error or corrupt value degrades to a default rather than
 * throwing into a render.
 *
 * This module knows nothing about React, mdast, or which labels a given
 * `::::tabs` group actually has - `resolveTabPreference` is handed the
 * page's current label list explicitly, so a stored value from a since-
 * edited page (a label that was renamed or removed) degrades to the
 * caller's fallback instead of selecting a tab that no longer exists.
 */

const TAB_PREFERENCE_KEY_PREFIX = "aniki-docs:tab-preference:";

/** The `localStorage` key a given `sync` id is stored under. */
export function tabPreferenceKey(sync: string): string {
  return `${TAB_PREFERENCE_KEY_PREFIX}${sync}`;
}

/**
 * Reads the stored label for a `sync` group. Returns `null` for a missing
 * key, corrupt JSON, a stored value that isn't a string, or a `storage`
 * that throws - every failure mode collapses to "no preference" rather
 * than propagating.
 *
 * @example
 * ```ts
 * readTabPreference(window.localStorage, "pkg"); // "pnpm" | null
 * ```
 */
export function readTabPreference(storage: Storage, sync: string): string | null {
  try {
    const raw = storage.getItem(tabPreferenceKey(sync));
    if (raw === null) {
      return null;
    }
    const parsed: unknown = JSON.parse(raw);
    return typeof parsed === "string" ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * Persists `value` as the selected label for a `sync` group. A quota-
 * exceeded or unavailable `storage` silently drops the write rather than
 * throwing.
 */
export function writeTabPreference(storage: Storage, sync: string, value: string): void {
  try {
    storage.setItem(tabPreferenceKey(sync), JSON.stringify(value));
  } catch {
    // Storage unavailable or full - the write is lost, not fatal.
  }
}

/**
 * Resolves the label a `sync` group should actually select: the stored
 * value, but only when it's still one of `availableLabels` - a stored
 * label from a page that has since dropped or renamed that tab falls back
 * to `fallback` instead of selecting nothing.
 *
 * @example
 * ```ts
 * resolveTabPreference("pnpm", ["npm", "pnpm", "yarn"], "npm"); // "pnpm"
 * resolveTabPreference("bun", ["npm", "pnpm", "yarn"], "npm");  // "npm" (stale)
 * resolveTabPreference(null, ["npm", "pnpm", "yarn"], "npm");   // "npm" (no preference)
 * ```
 */
export function resolveTabPreference(
  stored: string | null,
  availableLabels: readonly string[],
  fallback: string,
): string {
  if (stored !== null && availableLabels.includes(stored)) {
    return stored;
  }
  return fallback;
}
