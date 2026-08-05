/**
 * Public entry point for the client-side search system.
 *
 * IMPORTANT: this barrel must NEVER re-export `./indexer` (D2).
 * `indexer.ts` starts with `import "server-only"` and is the only module
 * in this directory allowed to touch `@/lib/content`; re-exporting it here
 * would poison every client import of this barrel with a server-only
 * build error. Only `app/api/search-index/route.ts` may import the
 * indexer directly.
 *
 * Every other module here is isomorphic, dependency-free TypeScript, safe
 * to import from both Server and Client Components.
 */

export {
  RecentSearchesStorageError,
  SearchError,
  SearchIndexFetchError,
  SearchIndexParseError,
  SearchIndexVersionError,
} from "./errors";
export type { SearchErrorCode } from "./errors";

export {
  CONTENT_WEIGHT,
  DESCRIPTION_WEIGHT,
  HEADING_WEIGHT,
  PHRASE_BONUS,
  POSITION_BONUS_MAX,
  TITLE_WEIGHT,
  compileSection,
  scoreSection,
} from "./score";
export type { CompiledSection } from "./score";

export { createSearchEngine } from "./engine";

export { normalize, splitIdentifier, tokenize, tokenizeQuery } from "./tokenize";
export type { TokenizedQuery } from "./tokenize";

export { SEARCH_INDEX_VERSION } from "./types";
export type {
  HighlightSegment,
  SearchEngine,
  SearchIndex,
  SearchOptions,
  SearchResult,
  SearchSection,
  SearchSnippet,
  SearchSuggestion,
} from "./types";
