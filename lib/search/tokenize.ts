/**
 * Query normalisation and tokenization for the search engine.
 *
 * Pure text transforms, no I/O and no dependency on the content or DOM
 * layers, so they can run identically at index-build time (Node) and at
 * query time (browser).
 */

const COMBINING_MARKS_PATTERN = /\p{Diacritic}/gu;
const NON_ALPHANUMERIC_PATTERN = /[^\p{L}\p{N}]+/gu;
const IDENTIFIER_BOUNDARY_PATTERN = /[_.\-\s]+|(?<=[a-z0-9])(?=[A-Z])|(?<=[A-Z])(?=[A-Z][a-z])/g;

/**
 * Normalises text for matching: Unicode NFKD decomposition, diacritic
 * stripping, lowercasing, and whitespace collapsing.
 *
 * NFKD splits an accented character like "é" into "e" plus a combining
 * mark, which the diacritic strip then removes - so "café" and "cafe"
 * normalise identically without a hand-maintained accent table.
 *
 * @example
 * ```ts
 * normalize("Café  Résumé"); // "cafe resume"
 * ```
 */
export function normalize(text: string): string {
  return text
    .normalize("NFKD")
    .replace(COMBINING_MARKS_PATTERN, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Splits an identifier-shaped token into its constituent words, so a
 * function name is findable by any of its parts.
 *
 * `generateText` must be findable by `generate`, `text`, and
 * `generatetext` - the whole token is kept in `tokenize` alongside these
 * parts, never replaced by them. Handles camelCase, PascalCase,
 * snake_case, kebab-case, and dotted paths uniformly by splitting on
 * underscores/hyphens/dots/whitespace and on lower-to-upper or
 * uppercase-run-to-titlecase boundaries.
 *
 * @example
 * ```ts
 * splitIdentifier("generateText");   // ["generate", "Text"]
 * splitIdentifier("snake_case_id");  // ["snake", "case", "id"]
 * splitIdentifier("HTTPServer");     // ["HTTP", "Server"]
 * ```
 */
export function splitIdentifier(token: string): string[] {
  return token
    .split(IDENTIFIER_BOUNDARY_PATTERN)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

function isMeaningful(token: string, singleCharacterQuery: boolean): boolean {
  return token.length > 1 || singleCharacterQuery;
}

/**
 * Normalises and tokenizes free text into a deduplicated, order-preserving
 * list of searchable tokens. Every token also contributes its
 * `splitIdentifier` sub-tokens (D9), so indexed content and queries match
 * on both the whole identifier and its parts.
 *
 * Tokens of length 1 are dropped unless the entire input is a single
 * character - a lone letter inside a longer query is almost always noise,
 * but a user who has typed exactly one character still deserves a
 * (typeahead) result.
 *
 * @example
 * ```ts
 * tokenize("generateText streaming"); // ["generatetext", "generate", "text", "streaming"]
 * ```
 */
export function tokenize(text: string): string[] {
  const normalized = normalize(text);
  const singleCharacterQuery = normalized.length === 1;
  const rawTokens = normalized.split(NON_ALPHANUMERIC_PATTERN).filter((t) => t.length > 0);

  const seen = new Set<string>();
  const tokens: string[] = [];

  function push(token: string): void {
    if (!isMeaningful(token, singleCharacterQuery)) {
      return;
    }
    if (seen.has(token)) {
      return;
    }
    seen.add(token);
    tokens.push(token);
  }

  for (const raw of rawTokens) {
    push(raw);
    for (const part of splitIdentifier(raw)) {
      push(normalize(part));
    }
  }

  return tokens;
}

/** Tokens plus the normalised whole-query phrase, for the phrase bonus in `scoreSection`. */
export interface TokenizedQuery {
  tokens: string[];
  phrase: string;
}

/**
 * Tokenizes a search-box query, additionally returning the normalised
 * whole phrase so the scorer can award a bonus for a contiguous substring
 * match (D8) on top of the per-token scoring.
 *
 * @example
 * ```ts
 * tokenizeQuery("tool calling");
 * // { tokens: ["tool", "calling"], phrase: "tool calling" }
 * ```
 */
export function tokenizeQuery(query: string): TokenizedQuery {
  return {
    tokens: tokenize(query),
    phrase: normalize(query),
  };
}
