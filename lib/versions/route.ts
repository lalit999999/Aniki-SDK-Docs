/**
 * Pure resolution of a `/docs/*` catch-all route's path segments into a
 * version id and (optionally) a document slug - D5's algorithm,
 * implemented exactly once so the `[...slug]` page and the version
 * switcher can never disagree about what a given URL means.
 *
 * Client-safe by construction (only imports from `@/lib/versions/registry`,
 * itself client-safe per T4) so both the Server Component route and the
 * Client Component switcher can call it directly.
 */

import { getLatestVersion, isKnownVersionId, isLatestVersionId } from "./registry";

/**
 * The result of resolving a `/docs/*` path's segments.
 */
export interface ResolvedDocsPath {
  /** The version these segments resolve to. */
  versionId: string;
  /** The document slug within that version, or `null` when the segments
   * resolve to the version's own index page. */
  docSlug: string | null;
}

/**
 * Resolves a catch-all route's path segments to a version and document
 * slug (D5):
 *
 * - a leading segment matching a known version id consumes that segment
 *   and resolves the rest against that version; otherwise every segment
 *   is resolved against the latest version
 * - zero remaining segments resolves to that version's index page
 * - exactly one remaining segment resolves to that document's slug
 * - more than one remaining segment has no resolution (the caller should
 *   call `notFound()`)
 *
 * @example
 * ```ts
 * resolveDocsPath([]);                    // { versionId: "v1", docSlug: null }      (v1 is latest)
 * resolveDocsPath(["introduction"]);      // { versionId: "v1", docSlug: "introduction" }
 * resolveDocsPath(["v1"]);                // { versionId: "v1", docSlug: null }
 * resolveDocsPath(["v1", "introduction"]); // { versionId: "v1", docSlug: "introduction" }
 * resolveDocsPath(["v1", "a", "b"]);      // null
 * resolveDocsPath(["not-a-version", "x"]); // null (too many segments against latest)
 * ```
 */
export function resolveDocsPath(segments: readonly string[]): ResolvedDocsPath | null {
  const first = segments[0];
  const isVersionPrefixed = first !== undefined && isKnownVersionId(first);

  const versionId = isVersionPrefixed ? first : getLatestVersion().id;
  const rest = isVersionPrefixed ? segments.slice(1) : segments;

  if (rest.length === 0) {
    return { versionId, docSlug: null };
  }
  if (rest.length === 1) {
    const slug = rest[0];
    if (slug === undefined) {
      return null;
    }
    return { versionId, docSlug: slug };
  }
  return null;
}

/**
 * The route to a version's own index page (D4): unprefixed `/docs` for the
 * latest version, `/docs/<versionId>` otherwise.
 *
 * @example
 * ```ts
 * docsIndexRoute("v1"); // "/docs" while v1 is latest, else "/docs/v1"
 * ```
 */
export function docsIndexRoute(versionId: string): string {
  return isLatestVersionId(versionId) ? "/docs" : `/docs/${versionId}`;
}
