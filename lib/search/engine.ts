/**
 * The in-memory search engine: precomputes each section's searchable
 * fields once, then scores and ranks against a query on every call.
 *
 * Deliberately hidden behind the `SearchEngine` interface (`./types`) so a
 * future Orama/Pagefind/Algolia-backed implementation can replace this one
 * without any component needing to change - see D1.
 */

import { compileSection, scoreSection } from "./score";
import type { CompiledSection } from "./score";
import { tokenizeQuery } from "./tokenize";
import type { HighlightSegment, SearchEngine, SearchIndex, SearchOptions, SearchResult, SearchSnippet } from "./types";

const DEFAULT_LIMIT = 8;
const DEFAULT_MAX_PER_DOCUMENT = 3;
const MIN_QUERY_LENGTH = 2;
/** Placeholder snippet window, superseded by `buildSnippet` in sub-task 5. */
const PLACEHOLDER_SNIPPET_LIMIT = 180;

function wholeFieldSegments(text: string): HighlightSegment[] {
  return [{ text, match: false }];
}

/**
 * Builds a plain, unhighlighted snippet from the head of a section's
 * content. Replaced by the diacritic-aware `buildSnippet` once
 * `lib/search/highlight.ts` lands (sub-task 5) - kept here as a real,
 * working fallback rather than an empty stub so `createSearchEngine` is
 * fully functional and testable on its own.
 */
function placeholderSnippet(content: string): SearchSnippet {
  if (content.length <= PLACEHOLDER_SNIPPET_LIMIT) {
    return { segments: wholeFieldSegments(content), truncatedStart: false, truncatedEnd: false };
  }
  const truncated = content.slice(0, PLACEHOLDER_SNIPPET_LIMIT);
  const lastSpace = truncated.lastIndexOf(" ");
  const text = lastSpace > 0 ? truncated.slice(0, lastSpace) : truncated;
  return { segments: wholeFieldSegments(text), truncatedStart: false, truncatedEnd: true };
}

function toResult(compiled: CompiledSection, score: number): SearchResult {
  const { section } = compiled;
  return {
    section,
    score,
    titleSegments: wholeFieldSegments(section.docTitle),
    headingSegments: section.headingText !== null ? wholeFieldSegments(section.headingText) : null,
    snippet: placeholderSnippet(section.content),
  };
}

/**
 * Builds a `SearchEngine` over a fetched `SearchIndex`. Construction does
 * all per-section normalisation work up front; `search()` itself only
 * tokenizes the query and scores against the precomputed fields, which is
 * what keeps repeated keystrokes fast against a corpus of a few hundred
 * sections.
 *
 * @example
 * ```ts
 * const engine = createSearchEngine(index);
 * engine.search("generate text", { limit: 5 });
 * ```
 */
export function createSearchEngine(index: SearchIndex): SearchEngine {
  const compiledSections = index.sections.map(compileSection);

  return {
    search(query: string, options?: SearchOptions): SearchResult[] {
      const trimmed = query.trim();
      if (trimmed.length < MIN_QUERY_LENGTH) {
        return [];
      }

      const { tokens, phrase } = tokenizeQuery(trimmed);
      if (tokens.length === 0) {
        return [];
      }

      const limit = options?.limit ?? DEFAULT_LIMIT;
      const maxPerDocument = options?.maxPerDocument ?? DEFAULT_MAX_PER_DOCUMENT;

      const scored = compiledSections
        .map((compiled) => ({ compiled, score: scoreSection(compiled, { tokens, phrase }) }))
        .filter((entry) => entry.score > 0)
        .sort((a, b) => {
          if (b.score !== a.score) {
            return b.score - a.score;
          }
          return a.compiled.section.order - b.compiled.section.order;
        });

      const perDocumentCount = new Map<string, number>();
      const results: SearchResult[] = [];

      for (const { compiled, score } of scored) {
        const docSlug = compiled.section.docSlug;
        const count = perDocumentCount.get(docSlug) ?? 0;
        if (count >= maxPerDocument) {
          continue;
        }
        perDocumentCount.set(docSlug, count + 1);
        results.push(toResult(compiled, score));
        if (results.length >= limit) {
          break;
        }
      }

      return results;
    },
  };
}
