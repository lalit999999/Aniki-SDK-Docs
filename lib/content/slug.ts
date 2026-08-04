/**
 * Pure slug helpers: filename -> route slug, slug -> route, slug -> title
 * fallback, and heading-anchor slugging. Nothing in this module touches
 * the filesystem - see `paths.ts` for that.
 */

import GithubSlugger from "github-slugger";

const FILE_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$|^index$/;

/**
 * Converts a markdown filename to its route slug.
 *
 * `README.md` is special-cased to `"index"` (D8: the docs set's own index
 * page routes to `/docs`, not `/docs/readme`). Every other file is
 * lowercased and stripped of its `.md` extension.
 *
 * @throws {Error} if the resulting slug isn't a clean lowercase,
 * hyphen-separated token (or `"index"`) - this indicates a filename that
 * can't produce a predictable route and should be renamed rather than
 * silently mangled.
 *
 * @example
 * ```ts
 * fileNameToSlug("README.md");     // "index"
 * fileNameToSlug("quick-start.md"); // "quick-start"
 * ```
 */
export function fileNameToSlug(fileName: string): string {
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

  return slug;
}

/**
 * Maps a route slug to its URL path (D8: the index slug routes to `/docs`
 * itself, not `/docs/index`).
 *
 * @example
 * ```ts
 * slugToRoute("index"); // "/docs"
 * slugToRoute("tools"); // "/docs/tools"
 * ```
 */
export function slugToRoute(slug: string): string {
  return slug === "index" ? "/docs" : `/docs/${slug}`;
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
