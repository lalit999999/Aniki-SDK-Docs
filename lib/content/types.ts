/**
 * Type definitions for the markdown content system.
 *
 * This module has no runtime behaviour - it exists purely to give the rest
 * of `lib/content` (and its consumers in later steps) a shared vocabulary
 * for documents, their metadata, and their derived structures (headings,
 * table of contents, reading time, navigation).
 */

/**
 * The three top-level sections documentation pages are grouped into.
 * Drives both frontmatter validation (`schema.ts`) and sidebar ordering
 * (`getDocNavigation` in `loader.ts`).
 */
export type DocCategory = "Getting Started" | "Core Concepts" | "Reference";

/**
 * Canonical category order. Navigation and any UI that groups documents by
 * category must iterate in this order rather than object/insertion order,
 * which is not guaranteed to match the intended reading sequence.
 *
 * @example
 * ```ts
 * for (const category of DOC_CATEGORIES) {
 *   console.log(category); // "Getting Started", then "Core Concepts", then "Reference"
 * }
 * ```
 */
export const DOC_CATEGORIES: readonly DocCategory[] = [
  "Getting Started",
  "Core Concepts",
  "Reference",
];

/**
 * The shape of a validated YAML frontmatter block, as authored at the top
 * of a `.md` file in `content/docs/`.
 *
 * `title`, `description`, and `category` are required on a fully-validated
 * document but may be absent during the lenient parse used for files with
 * no frontmatter at all - see `parsePartialFrontmatter` in `schema.ts`.
 */
export interface DocFrontmatter {
  /** Page title. Falls back to the document's leading H1, then a
   * prettified filename, when frontmatter omits it. */
  title: string;
  /** One-sentence summary, used for `<meta name="description">` and nav
   * tooltips. Must not contain markdown syntax such as backticks. */
  description: string;
  /** Which sidebar section this document belongs to. */
  category: DocCategory;
  /** Sort position within `category`, ascending. */
  order: number;
  /** ISO date (`YYYY-MM-DD`) the content was last meaningfully updated,
   * as declared by the author. Authoritative over git/filesystem dates
   * when present - see `resolveLastModified` in `git.ts`. */
  updated?: string;
  /** Explicit slug override. Reserved for a future case where the
   * filename-derived slug isn't the desired route segment. */
  slug?: string;
  /** When `true`, the document is excluded from all list/nav functions in
   * production and included in development for authoring preview.
   * Defaults to `false`. */
  draft?: boolean;
  /** Free-form tags for future search/filtering. Defaults to `[]`. */
  tags?: readonly string[];
}

/**
 * Which source ultimately supplied a document's `updatedAt` value, per the
 * precedence chain in `resolveLastModified`: frontmatter, then git, then
 * filesystem `mtime`, then `"unknown"` if all three came up empty.
 */
export type UpdatedSource = "frontmatter" | "git" | "filesystem" | "unknown";

/**
 * Estimated reading time for a document's prose, excluding fenced/inline
 * code by default (see `calculateReadingTime` in `reading-time.ts`).
 */
export interface DocReadingTime {
  /** Rounded up, minimum 1. */
  minutes: number;
  /** Prose word count the estimate was derived from. */
  words: number;
  /** Human-readable label, e.g. `"4 min read"`. */
  text: string;
}

/**
 * A single heading extracted from a document's markdown AST.
 */
export interface DocHeading {
  /** GitHub-slugger-generated anchor id, deduplicated within the document
   * that produced it (`goal`, `goal-1`, `goal-2`, ...). */
  id: string;
  /** Plain text content of the heading, with any inline markdown
   * (emphasis, code spans, links) flattened to text. */
  text: string;
  /** Heading depth. H1 is deliberately excluded from extraction - see
   * `extractHeadings` in `headings.ts` - so this only ever ranges 2-6. */
  level: 2 | 3 | 4 | 5 | 6;
}

/**
 * A `DocHeading` nested under its structural parent, forming the tree a
 * table-of-contents UI renders. Produced by `buildToc` in `toc.ts`.
 */
export interface TocNode extends DocHeading {
  children: TocNode[];
}

/**
 * Everything about a document except its body - cheap to compute for every
 * file, and what navigation, sitemaps, and "previous/next" links are built
 * from without needing to parse full content.
 */
export interface DocMeta {
  /** URL-safe identifier derived from the filename (`README.md` -> `index`). */
  slug: string;
  /** Route this document resolves to: `/docs` for the index, otherwise
   * `/docs/<slug>`. */
  route: string;
  /** Path to the source file, relative to the repository root. */
  filePath: string;
  title: string;
  description: string;
  category: DocCategory;
  order: number;
  tags: readonly string[];
  draft: boolean;
  /** ISO 8601 timestamp, or `null` if no source could supply one. */
  updatedAt: string | null;
  updatedSource: UpdatedSource;
  readingTime: DocReadingTime;
}

/**
 * A fully-loaded document: its metadata plus parsed content and structure.
 */
export interface Doc {
  meta: DocMeta;
  /** Markdown body with the leading H1 stripped - what a renderer should
   * display, since the title already appears via `meta.title`. */
  content: string;
  /** Markdown body exactly as it appears after the frontmatter block,
   * H1 included. Useful for search indexing or raw export. */
  rawContent: string;
  /** Flat list of H2-H3 headings, in document order. */
  headings: DocHeading[];
  /** `headings` nested into a tree for table-of-contents rendering. */
  toc: TocNode[];
}

/**
 * One category's worth of documents, in sidebar order. The unit
 * `getDocNavigation` returns a list of.
 */
export interface DocNavCategory {
  category: DocCategory;
  docs: readonly DocMeta[];
}

/**
 * The documents immediately before and after a given document in the
 * flattened navigation order (crossing category boundaries). Either side
 * is `null` at the start/end of the whole document set.
 */
export interface AdjacentDocs {
  previous: DocMeta | null;
  next: DocMeta | null;
}
