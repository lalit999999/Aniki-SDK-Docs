/**
 * Pure slug helpers: filename -> route slug, slug -> route, slug -> title
 * fallback, and heading-anchor slugging. Nothing in this module touches
 * the filesystem - see `paths.ts` for that.
 */

import GithubSlugger from "github-slugger";

import { getLatestVersion, isLatestVersionId, VERSION_ID_PATTERN } from "@/lib/versions/registry";

import { ReservedSlugError } from "./errors";

const FILE_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$|^index$/;

/**
 * Converts a markdown filename to its route slug.
 *
 * `README.md` is special-cased to `"index"` (D8: the docs set's own index
 * page routes to `/docs`, not `/docs/readme`). Every other file is
 * lowercased and stripped of its `.md` extension.
 *
 * @param filePath - the file's path, used only to enrich error context
 * (`ReservedSlugError`, `Error`) with something more useful than the bare
 * filename. Defaults to `fileName` when omitted.
 *
 * @throws {Error} if the resulting slug isn't a clean lowercase,
 * hyphen-separated token (or `"index"`) - this indicates a filename that
 * can't produce a predictable route and should be renamed rather than
 * silently mangled.
 * @throws {ReservedSlugError} if the resulting slug matches
 * `VERSION_ID_PATTERN` (e.g. a file named `v2.md`) - such a slug would be
 * unreachable, since `resolveDocsPath` always treats a leading `v<n>`
 * segment as a version id, never a page slug.
 *
 * @example
 * ```ts
 * fileNameToSlug("README.md");     // "index"
 * fileNameToSlug("quick-start.md"); // "quick-start"
 * ```
 */
export function fileNameToSlug(fileName: string, filePath?: string): string {
  const withoutExtension = fileName.replace(/\.md$/i, "");
  const slug = withoutExtension.toLowerCase() === "readme"
    ? "index"
    : withoutExtension.toLowerCase();

  if (!FILE_SLUG_PATTERN.test(slug)) {
    throw new Error(
      `"${fileName}" does not produce a clean slug ("${slug}"); ` +
        "rename the file to lowercase, hyphen-separated words.",
    );
  }

  if (VERSION_ID_PATTERN.test(slug)) {
    throw new ReservedSlugError(
      `slug "${slug}" (from "${fileName}") collides with the documentation version id pattern`,
      { slug, filePath: filePath ?? fileName },
    );
  }

  return slug;
}

/**
 * Maps a document slug to its URL path (D4/D8). The index slug routes to
 * a version's own root rather than an `/index` segment. Omitting
 * `versionId` resolves the latest version, which - per D4/D6 - is served
 * unprefixed at `/docs`; any other version is served under `/docs/<id>`.
 *
 * @example
 * ```ts
 * slugToRoute("index");        // "/docs" (latest version)
 * slugToRoute("tools");        // "/docs/tools" (latest version)
 * slugToRoute("index", "v1");  // "/docs" if v1 is latest, else "/docs/v1"
 * slugToRoute("tools", "v1");  // "/docs/tools" if v1 is latest, else "/docs/v1/tools"
 * ```
 */
export function slugToRoute(slug: string, versionId?: string): string {
  const resolvedVersionId = versionId ?? getLatestVersion().id;

  if (isLatestVersionId(resolvedVersionId)) {
    return slug === "index" ? "/docs" : `/docs/${slug}`;
  }

  return slug === "index" ? `/docs/${resolvedVersionId}` : `/docs/${resolvedVersionId}/${slug}`;
}

/**
 * Maps a document slug to its URL path, always prefixed with `versionId`
 * regardless of whether that version is currently latest. Used where a
 * link must point at a *specific* version's copy of a page even after a
 * newer version takes over the unprefixed `/docs` URLs - e.g. the legacy
 * version banner linking back to the page a reader was viewing.
 *
 * @example
 * ```ts
 * slugToVersionedRoute("tools", "v1"); // "/docs/v1/tools", always
 * ```
 */
export function slugToVersionedRoute(slug: string, versionId: string): string {
  return slug === "index" ? `/docs/${versionId}` : `/docs/${versionId}/${slug}`;
}

/**
 * Prettifies a hyphenated slug into a title-cased fallback, for documents
 * whose frontmatter and leading H1 are both absent.
 *
 * @example
 * ```ts
 * slugToTitle("quick-start"); // "Quick Start"
 * ```
 */
export function slugToTitle(slug: string): string {
  return slug
    .split("-")
    .filter((word) => word.length > 0)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/**
 * A heading slugger scoped to a single document.
 */
export interface HeadingSlugger {
  /** Returns a deduplicated, GitHub-compatible anchor id for `text`. */
  slug(text: string): string;
}

/**
 * Creates a fresh heading slugger backed by a new `github-slugger`
 * instance.
 *
 * IMPORTANT: one slugger belongs to exactly one document. `github-slugger`
 * deduplicates by remembering every slug it has produced (`goal`, `goal-1`,
 * `goal-2`, ...) for the lifetime of the instance. Reusing one instance
 * across documents - or across multiple calls to `getAllDocs` - silently
 * corrupts every anchor after the first: a second document's first "Goal"
 * heading would come out as `goal-9` instead of `goal`, because the
 * slugger still remembers the previous document's headings. Always call
 * `createHeadingSlugger()` once per document, immediately before walking
 * that document's headings.
 *
 * @example
 * ```ts
 * const slugger = createHeadingSlugger();
 * slugger.slug("Goal"); // "goal"
 * slugger.slug("Goal"); // "goal-1"
 * slugger.slug("Goal"); // "goal-2"
 * ```
 */
export function createHeadingSlugger(): HeadingSlugger {
  const slugger = new GithubSlugger();
  return {
    slug: (text: string) => slugger.slug(text),
  };
}
