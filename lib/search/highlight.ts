/**
 * Match highlighting and snippet extraction.
 *
 * Returns `HighlightSegment[]` (D7), never HTML - `dangerouslySetInnerHTML`
 * is forbidden for search results, both as an XSS boundary (section
 * content originates from markdown files, not user input, but the query
 * itself is user input reflected back into the match) and because plain
 * segment data is what makes offset mapping unit-testable in a node
 * environment with no DOM.
 *
 * Offset mapping is the one genuinely tricky part of this module: a match
 * is found in *normalised* (diacritic-folded, lowercased) text, but the
 * segment returned to the UI must slice the *original* text so casing and
 * accents survive into the rendered `<mark>`. `buildNormalizedMap` folds
 * one character at a time (via `normalizeChar`) instead of the whole
 * string at once specifically so each output character can be traced back
 * to the original index it came from.
 */

import { normalizeChar } from "./tokenize";
import type { HighlightSegment, SearchSnippet } from "./types";

interface NormalizedMap {
  normalized: string;
  /** `map[i]` is the original-text index the character at `normalized[i]`
   * was folded from. */
  map: number[];
}

function buildNormalizedMap(text: string): NormalizedMap {
  let normalized = "";
  const map: number[] = [];

  for (let i = 0; i < text.length; i++) {
    const folded = normalizeChar(text[i] ?? "");
    for (const foldedChar of folded) {
      normalized += foldedChar;
      map.push(i);
    }
  }

  return { normalized, map };
}

type Range = readonly [start: number, end: number];

function mergeRanges(ranges: readonly Range[]): Range[] {
  if (ranges.length === 0) {
    return [];
  }
  const sorted = [...ranges].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const merged: [number, number][] = [];

  for (const [start, end] of sorted) {
    const last = merged[merged.length - 1];
    if (last !== undefined && start <= last[1]) {
      last[1] = Math.max(last[1], end);
    } else {
      merged.push([start, end]);
    }
  }

  return merged;
}

/**
 * Finds every non-overlapping match of any `tokens` entry in `text`,
 * matched case- and diacritic-insensitively, and returns the ranges in
 * **original** `text` coordinates, merged where they overlap.
 */
function findMatchRanges(text: string, tokens: readonly string[]): Range[] {
  const meaningfulTokens = tokens.filter((token) => token.length > 0);
  if (meaningfulTokens.length === 0 || text.length === 0) {
    return [];
  }

  const { normalized, map } = buildNormalizedMap(text);
  const normalizedRanges: Range[] = [];

  for (const token of meaningfulTokens) {
    let searchFrom = 0;
    let index = normalized.indexOf(token, searchFrom);
    while (index !== -1) {
      normalizedRanges.push([index, index + token.length]);
      searchFrom = index + 1;
      index = normalized.indexOf(token, searchFrom);
    }
  }

  if (normalizedRanges.length === 0) {
    return [];
  }

  return mergeRanges(normalizedRanges).map(([start, end]): Range => {
    const origStart = map[start] ?? text.length;
    const origEnd = end < map.length ? (map[end] ?? text.length) : text.length;
    return [origStart, origEnd];
  });
}

/**
 * Splits `text` into alternating matched/unmatched segments against
 * `tokens`, preserving the source's original casing and accents.
 * Overlapping matches (e.g. two tokens that share a substring) merge into
 * a single segment. A text with no matches returns a single unmatched
 * segment, never an empty array - simplifies every consumer to a plain
 * `.map()`.
 *
 * @example
 * ```ts
 * highlight("Café Résumé", ["cafe"]);
 * // [{ text: "Café", match: true }, { text: " Résumé", match: false }]
 * ```
 */
export function highlight(text: string, tokens: readonly string[]): HighlightSegment[] {
  const ranges = findMatchRanges(text, tokens);
  if (ranges.length === 0) {
    return [{ text, match: false }];
  }

  const segments: HighlightSegment[] = [];
  let cursor = 0;

  for (const [start, end] of ranges) {
    if (start > cursor) {
      segments.push({ text: text.slice(cursor, start), match: false });
    }
    segments.push({ text: text.slice(start, end), match: true });
    cursor = end;
  }

  if (cursor < text.length) {
    segments.push({ text: text.slice(cursor), match: false });
  }

  return segments;
}

export interface BuildSnippetOptions {
  /** Characters of context kept on each side of the first match before
   * expanding to a word boundary. Defaults to 90. */
  radius?: number;
}

const DEFAULT_SNIPPET_RADIUS = 90;

/**
 * Builds a windowed, highlighted excerpt of `text` centered on its first
 * match against `tokens` (or the head of the text, when nothing matches),
 * expanded outward to whole-word boundaries so a snippet never starts or
 * ends mid-word.
 *
 * @example
 * ```ts
 * buildSnippet(section.content, ["stream"], { radius: 40 });
 * // { segments: [...], truncatedStart: true, truncatedEnd: true }
 * ```
 */
export function buildSnippet(
  text: string,
  tokens: readonly string[],
  options?: BuildSnippetOptions,
): SearchSnippet {
  const radius = options?.radius ?? DEFAULT_SNIPPET_RADIUS;
  const ranges = findMatchRanges(text, tokens);
  const anchor = ranges[0];

  let start: number;
  let end: number;

  if (anchor !== undefined) {
    start = Math.max(0, anchor[0] - radius);
    end = Math.min(text.length, anchor[1] + radius);
  } else {
    start = 0;
    end = Math.min(text.length, radius * 2);
  }

  while (start > 0 && text[start - 1] !== " ") {
    start--;
  }
  while (end < text.length && text[end] !== " ") {
    end++;
  }

  const truncatedStart = start > 0;
  const truncatedEnd = end < text.length;
  const windowText = text.slice(start, end).trim();

  return {
    segments: highlight(windowText, tokens),
    truncatedStart,
    truncatedEnd,
  };
}
