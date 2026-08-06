/**
 * Type definitions for the changelog content system. Mirrors
 * `lib/content/types.ts`'s shape - a `*Meta` type cheap to compute for
 * every release, and a full type that adds parsed body content - rather
 * than inventing a different vocabulary for what is structurally the same
 * problem (a directory of frontmatter'd markdown files).
 */

import type { DocHeading, TocNode } from "@/lib/content/types";

/** Publication state of a release. `"yanked"` marks a release pulled after
 * publication (a bad build, a security issue) without deleting its notes -
 * the history stays honest, the status flags it as not-for-use. */
export type ReleaseStatus = "stable" | "prerelease" | "yanked";

/**
 * The shape of a validated YAML frontmatter block, as authored at the top
 * of a `.md` file in `content/changelog/`.
 */
export interface ReleaseFrontmatter {
  /** Semantic version, e.g. `"1.0.0"`. Must be quoted in YAML (T10) -
   * `version: 1.0` parses as the number `1`. */
  version: string;
  title: string;
  /** ISO date (`YYYY-MM-DD`) the release shipped. */
  date: string;
  /** The documentation version this release's docs correspond to. Must
   * match a declared id in `DOCS_VERSIONS`. */
  docsVersion: string;
  status: ReleaseStatus;
  summary: string;
  /** Short bullet highlights, shown on the `/changelog` index without
   * needing to open the full release notes. */
  highlights: readonly string[];
}

/**
 * Everything about a release except its body - what the `/changelog`
 * index and adjacent-release navigation are built from.
 */
export interface ReleaseMeta extends ReleaseFrontmatter {
  /** URL-safe identifier: `"v" + version`, e.g. `"v1.0.0"`. */
  slug: string;
  /** Route this release resolves to: `/changelog/<slug>`. */
  route: string;
  /** Path to the source file, relative to the repository root. */
  filePath: string;
}

/**
 * A fully-loaded release: its metadata plus parsed content and structure.
 */
export interface Release {
  meta: ReleaseMeta;
  /** Markdown body exactly as it appears after the frontmatter block. */
  content: string;
  /** Flat list of H2-H3 headings (`## Features`, `## Fixes`, `## Breaking
   * Changes`, ...), in document order. */
  headings: DocHeading[];
  /** `headings` nested into a tree, for parity with `DocsContent`'s
   * table-of-contents input even though release notes don't render one
   * today. */
  toc: TocNode[];
}

/**
 * The releases immediately before and after a given release in
 * newest-first order. Either side is `null` at the start/end of the
 * release history.
 */
export interface AdjacentReleases {
  previous: ReleaseMeta | null;
  next: ReleaseMeta | null;
}
