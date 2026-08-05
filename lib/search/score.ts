/**
 * Relevance scoring for the in-memory search engine (D8).
 *
 * Scoring operates on a `CompiledSection` - a section's searchable fields
 * pre-tokenized and pre-normalized once - rather than a raw `SearchSection`,
 * so `createSearchEngine` can do that work exactly once at construction
 * instead of re-tokenizing every field of every section on every
 * keystroke. `compileSection` is the seam between the two: call it once
 * per section, then call `scoreSection` as many times as needed against
 * the result.
 */

import { normalize, tokenize } from "./tokenize";
import type { SearchSection } from "./types";

/** Weight applied per matching token in the document title. Highest,
 * since a title match is the strongest possible relevance signal. */
export const TITLE_WEIGHT = 10;
/** Weight applied per matching token in the section's own heading. */
export const HEADING_WEIGHT = 6;
/** Weight applied per matching token in the document description. */
export const DESCRIPTION_WEIGHT = 3;
/** Weight applied per matching token in the section's prose content. */
export const CONTENT_WEIGHT = 1;
/** Flat bonus added once when the full normalised query appears as a
 * contiguous substring anywhere in the section's searchable text. */
export const PHRASE_BONUS = 8;
/** Maximum bonus for a token matching near the start of a field, decaying
 * to 0 by the fourth token position. Keeps ordering-sensitive without
 * letting position ever outweigh a higher-weighted field. */
export const POSITION_BONUS_MAX = 1.5;

/** A section's searchable fields, tokenized and normalised once so
 * `scoreSection` never has to redo that work per keystroke. */
export interface CompiledSection {
  section: SearchSection;
  titleTokens: string[];
  headingTokens: string[];
  descriptionTokens: string[];
  contentTokens: string[];
  combinedNormalized: string;
}

/**
 * Precomputes a section's searchable fields. Call once per section (at
 * engine construction), never per search.
 *
 * @example
 * ```ts
 * const compiled = index.sections.map(compileSection);
 * ```
 */
export function compileSection(section: SearchSection): CompiledSection {
  const titleTokens = tokenize(section.docTitle);
  const headingTokens = section.headingText !== null ? tokenize(section.headingText) : [];
  const descriptionTokens = tokenize(section.docDescription);
  const contentTokens = tokenize(section.content);

  const combinedNormalized = normalize(
    [section.docTitle, section.headingText ?? "", section.docDescription, section.content].join(" "),
  );

  return { section, titleTokens, headingTokens, descriptionTokens, contentTokens, combinedNormalized };
}

function tokenPosition(fieldTokens: readonly string[], token: string, isPrefix: boolean): number {
  return fieldTokens.findIndex((candidate) => (isPrefix ? candidate.startsWith(token) : candidate === token));
}

function fieldScore(fieldTokens: readonly string[], token: string, isPrefix: boolean, weight: number): number {
  const index = tokenPosition(fieldTokens, token, isPrefix);
  if (index === -1) {
    return 0;
  }
  const positionBonus = Math.max(0, POSITION_BONUS_MAX - index * 0.5);
  return weight + positionBonus;
}

/**
 * Scores a compiled section against a tokenized query (D8): every token
 * must match somewhere across the four fields or the section scores `0`
 * ("agent tool" must not return every page that merely mentions "agent");
 * matches are weighted per field and summed, the final query token may
 * match as a prefix (live-typing feel), earlier tokens must match a whole
 * field token, and a contiguous phrase match anywhere adds a flat bonus.
 *
 * @example
 * ```ts
 * const compiled = compileSection(section);
 * scoreSection(compiled, { tokens: ["generate", "text"], phrase: "generate text" });
 * ```
 */
export function scoreSection(
  compiled: CompiledSection,
  query: { tokens: readonly string[]; phrase: string },
): number {
  const { tokens, phrase } = query;
  if (tokens.length === 0) {
    return 0;
  }

  let total = 0;

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (token === undefined) {
      continue;
    }
    const isPrefix = i === tokens.length - 1;

    const titleScore = fieldScore(compiled.titleTokens, token, isPrefix, TITLE_WEIGHT);
    const headingScore = fieldScore(compiled.headingTokens, token, isPrefix, HEADING_WEIGHT);
    const descriptionScore = fieldScore(compiled.descriptionTokens, token, isPrefix, DESCRIPTION_WEIGHT);
    const contentScore = fieldScore(compiled.contentTokens, token, isPrefix, CONTENT_WEIGHT);

    const tokenScore = titleScore + headingScore + descriptionScore + contentScore;
    if (tokenScore === 0) {
      // This token matched nothing anywhere - the whole section is
      // disqualified regardless of how well the other tokens matched.
      return 0;
    }
    total += tokenScore;
  }

  if (phrase.length > 0 && compiled.combinedNormalized.includes(phrase)) {
    total += PHRASE_BONUS;
  }

  return total;
}
