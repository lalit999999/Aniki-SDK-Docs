/**
 * The in-memory search engine: precomputes each section's searchable
 * fields once, then scores and ranks against a query on every call.
 *
 * Deliberately hidden behind the `SearchEngine` interface (`./types`) so a
 * future Orama/Pagefind/Algolia-backed implementation can replace this one
 * without any component needing to change - see D1.
 */

import { buildSnippet, highlight } from "./highlight";
import { compileSection, scoreSection } from "./score";
import type { CompiledSection } from "./score";
import { tokenizeQuery } from "./tokenize";
import type { SearchEngine, SearchIndex, SearchOptions, SearchResult } from "./types";

const DEFAULT_LIMIT = 8;
const DEFAULT_MAX_PER_DOCUMENT = 3;
const MIN_QUERY_LENGTH = 2;

function toResult(compiled: CompiledSection, score: number, tokens: readonly string[]): SearchResult {
  const { section } = compiled;
  return {
    section,
    score,
    titleSegments: highlight(section.docTitle, tokens),
    headingSegments: section.headingText !== null ? highlight(section.headingText, tokens) : null,
    snippet: buildSnippet(section.content, tokens),
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
        results.push(toResult(compiled, score, tokens));
        if (results.length >= limit) {
          break;
        }
      }

      return results;
    },
  };
}
