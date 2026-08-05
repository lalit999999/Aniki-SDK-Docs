/**
 * Type definitions for the client-side documentation search system.
 *
 * This module has no runtime behaviour - it exists purely to give the rest
 * of `lib/search` (and its consumers in the command palette) a shared
 * vocabulary for indexed sections, search results, and the engine
 * contract. Mirrors the shape of `lib/content/types.ts`.
 */

import type { DocCategory } from "@/lib/content/types";

/**
 * Current shape version of the serialized search index. Bump this whenever
 * `SearchSection`'s fields change so a stale client-cached index (or a CDN
 * edge that hasn't picked up a redeploy yet) is detected instead of
 * silently misinterpreted - see `SearchIndexVersionError`.
 */
export const SEARCH_INDEX_VERSION = 1;

/**
 * One indexed unit: the run of markdown between a heading (H2-H4) and the
 * next heading of equal-or-shallower depth, or the "lead" content before a
 * document's first heading. Indexing at section granularity (rather than
 * one entry per document) is what lets a result deep-link straight to
 * `#anchor` instead of dropping the user at the top of a long page.
 */
export interface SearchSection {
  /** Globally unique id: `"<docSlug>#<headingId ?? 'lead'>"`. Used as the
   * cmdk item `value` (T3) - never parsed, only compared. */
  id: string;
  docSlug: string;
  docTitle: string;
  docDescription: string;
  category: DocCategory;
  /** The document's route, without a hash. */
  route: string;
  /** `route` plus `#headingId` when this section has a heading; equal to
   * `route` for a lead section. */
  href: string;
  headingId: string | null;
  headingText: string | null;
  headingLevel: 2 | 3 | 4 | null;
  /** Prose text of the section, fenced code excluded, capped at
   * `SECTION_CONTENT_LIMIT` characters. */
  content: string;
  /** Document-order position, used as a deterministic tie-break when two
   * sections score identically. */
  order: number;
}

/**
 * The full serialized search index, as built by `buildSearchIndex` and
 * served from `/api/search-index`.
 */
export interface SearchIndex {
  version: number;
  /** ISO 8601 timestamp of when the index was built. */
  generatedAt: string;
  sections: SearchSection[];
}

/** One highlighted run of text: either part of a query match or not. */
export interface HighlightSegment {
  text: string;
  match: boolean;
}

/**
 * A windowed, highlighted excerpt of a section's content, built around the
 * first query match (or the head of the text when there is no match).
 */
export interface SearchSnippet {
  segments: HighlightSegment[];
  /** `true` when the snippet's start was cut from the middle of the
   * section's content (render a leading ellipsis). */
  truncatedStart: boolean;
  /** `true` when the snippet's end was cut short of the section's content
   * (render a trailing ellipsis). */
  truncatedEnd: boolean;
}

/** One scored, highlighted match returned by `SearchEngine.search`. */
export interface SearchResult {
  section: SearchSection;
  score: number;
  titleSegments: HighlightSegment[];
  headingSegments: HighlightSegment[] | null;
  snippet: SearchSnippet;
}

/**
 * A curated or derived entry point shown in the palette's empty-query or
 * no-results states.
 */
export interface SearchSuggestion {
  label: string;
  href: string;
  reason: "popular" | "category" | "recent";
}

export interface SearchOptions {
  /** Maximum results returned, after grouping. Defaults to 8. */
  limit?: number;
  /** Maximum results from a single document, so one long page can't
   * monopolise the list. Defaults to 3. */
  maxPerDocument?: number;
}

/**
 * The contract the command palette depends on. Kept deliberately narrow -
 * one method, plain data in and out - so the hand-rolled in-memory engine
 * (`createSearchEngine`) can be swapped for Orama, Pagefind, or Algolia
 * later without touching a single component.
 *
 * @example
 * ```ts
 * const engine: SearchEngine = createSearchEngine(index);
 * const results = engine.search("generate text", { limit: 5 });
 * ```
 */
export interface SearchEngine {
  search(query: string, options?: SearchOptions): SearchResult[];
}
