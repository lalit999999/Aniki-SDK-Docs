/**
 * Reading time estimation, computed from AST-extracted prose with code
 * excluded by default.
 *
 * Feeding raw markdown straight to `reading-time` inflates the estimate
 * badly for reference-heavy pages: `api-reference.md` is over a thousand
 * lines and predominantly code, but nobody reads a reference code block
 * at 200 words per minute - they scan it. Extracting only prose text
 * (optionally still including code, via `includeCode`) keeps the estimate
 * meaningful.
 */

import type { Root, RootContent } from "mdast";
import readingTime from "reading-time";

import type { DocReadingTime } from "./types";

type Node = Root | RootContent;

function hasStringValue(node: Node): node is Node & { value: string } {
  return "value" in node && typeof (node as { value?: unknown }).value === "string";
}

function hasChildren(node: Node): node is Node & { children: RootContent[] } {
  return "children" in node && Array.isArray((node as { children?: unknown }).children);
}

function collectText(node: Node, includeCode: boolean, parts: string[]): void {
  if (node.type === "code" || node.type === "inlineCode") {
    if (includeCode && hasStringValue(node)) {
      parts.push(node.value);
    }
    return;
  }

  if (hasStringValue(node)) {
    parts.push(node.value);
    return;
  }

  if (hasChildren(node)) {
    for (const child of node.children) {
      collectText(child, includeCode, parts);
    }
  }
}

/**
 * Extracts the prose text of a document, skipping `code` and `inlineCode`
 * nodes unless `includeCode` is `true`.
 *
 * @example
 * ```ts
 * const tree = parseMarkdown(source, filePath);
 * extractProse(tree); // prose only, fenced/inline code omitted
 * extractProse(tree, { includeCode: true }); // everything, code included
 * ```
 */
export function extractProse(tree: Root, options?: { includeCode?: boolean }): string {
  const includeCode = options?.includeCode ?? false;
  const parts: string[] = [];
  collectText(tree, includeCode, parts);
  return parts.join(" ").replace(/\s+/g, " ").trim();
}

/**
 * Computes reading time for a document's prose. `minutes` is always
 * rounded up and floored at 1, and `text` is built from that already-
 * rounded value rather than trusting `reading-time`'s own formatting, so
 * the two never disagree (e.g. "1 min read" never sits next to `0.4`).
 *
 * @example
 * ```ts
 * const tree = parseMarkdown(source, filePath);
 * calculateReadingTime(tree); // { minutes: 4, words: 812, text: "4 min read" }
 * ```
 */
export function calculateReadingTime(
  tree: Root,
  options?: { includeCode?: boolean },
): DocReadingTime {
  const prose = extractProse(tree, options);
  const stats = readingTime(prose);
  const minutes = Math.max(1, Math.ceil(stats.minutes));

  return {
    minutes,
    words: stats.words,
    text: `${minutes} min read`,
  };
}
