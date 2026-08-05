/**
 * Type definitions for the documentation version registry.
 *
 * This module has no runtime behaviour and no filesystem access - it is
 * imported by `config/versions.ts` (a human-edited data file), by
 * `next.config.ts` (T5), and by client components (T4/T2), so it must stay
 * as lightweight as `lib/content/types.ts` is for the content system.
 */

/**
 * Lifecycle state of a documentation version.
 *
 * - `"latest"` - served at the unprefixed `/docs` URLs (D4). Exactly one
 *   version may hold this status at a time.
 * - `"maintenance"` - still fully indexable, served at `/docs/<id>/*`, with
 *   a banner pointing at the latest version.
 * - `"deprecated"` - same URLs as `"maintenance"`, but marked
 *   non-indexable (D13) and with a more urgent banner (D9).
 */
export type DocsVersionStatus = "latest" | "maintenance" | "deprecated";

/**
 * A single declared documentation version, as authored in
 * `config/versions.ts`. This is the one place a human edits to ship a new
 * docs version (D2) - everything else (content directories, routes,
 * redirects) is derived from this data.
 */
export interface DocsVersion {
  /** Directory-safe identifier, also the version's URL segment when it
   * isn't latest. Must match `VERSION_ID_PATTERN`, e.g. `"v1"`, `"v1.1"`. */
  id: string;
  /** Human-readable label shown in the version switcher, e.g. `"v1.0"`. */
  label: string;
  status: DocsVersionStatus;
  /** ISO date (`YYYY-MM-DD`) this version was released. */
  releasedAt: string;
  /** The Aniki SDK package version range this docs version covers, e.g.
   * `"0.1.x"`. Purely informational. */
  sdkVersion?: string;
  /** Slug (within this version) of the guide for migrating from the
   * previous version, if one exists. Validated to resolve to a real page
   * when the content index is built (D4 in the sub-task 4 spec). */
  migrationGuideSlug?: string;
  /** Short custom banner text shown on every page of this version, in
   * addition to (not instead of) the standard legacy notice. */
  notice?: string;
}

/**
 * A `DocsVersion` enriched with derived facts the loader alone can supply:
 * how many pages it has, and where its index page lives. Returned by
 * `getDocVersions()` in `lib/content/loader.ts`.
 */
export interface DocsVersionSummary extends DocsVersion {
  /** Number of visible (non-draft) documents in this version. */
  docCount: number;
  /** Route to this version's index page: `/docs` for latest, `/docs/<id>`
   * otherwise (D4). */
  indexRoute: string;
}
