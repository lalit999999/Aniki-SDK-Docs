/**
 * AST-based markdown parsing and heading extraction.
 *
 * Headings MUST be read from the parsed mdast tree, never with a regex.
 * `content/docs/installation.md` contains `# pnpm`, `# yarn`, `# bun`
 * inside a fenced bash block - a regex heading matcher would produce
 * three garbage table-of-contents entries there. In the AST, fenced code
 * becomes a `code` leaf node with no children, so a heading walk that
 * only descends into `children` arrays never sees them.
 */

import { toString as mdastToString } from "mdast-util-to-string";
import type { Heading, Root, RootContent } from "mdast";
import { unified } from "unified";
import remarkParse from "remark-parse";

import { MarkdownParseError } from "./errors";
import { createHeadingSlugger } from "./slug";
import type { DocHeading } from "./types";

const processor = unified().use(remarkParse);

/**
 * Parses markdown source into an mdast `Root`.
 *
 * @throws {MarkdownParseError} if remark-parse throws while parsing.
 *
 * @example
 * ```ts
 * const tree = parseMarkdown("# Title\n\nBody.", "content/docs/foo.md");
 * ```
 */
export function parseMarkdown(markdown: string, filePath: string): Root {
  try {
    return processor.parse(markdown);
  } catch (error: unknown) {
    const cause = error instanceof Error ? error : undefined;
    throw new MarkdownParseError(`failed to parse markdown: ${filePath}`, { filePath }, cause);
  }
}

function isHeading(node: RootContent): node is Heading {
  return node.type === "heading";
}

function hasChildren(node: RootContent): node is RootContent & { children: RootContent[] } {
  return "children" in node && Array.isArray((node as { children?: unknown }).children);
}

function collectHeadings(nodes: readonly RootContent[], out: Heading[]): void {
  for (const node of nodes) {
    if (isHeading(node)) {
      out.push(node);
    }
    if (hasChildren(node)) {
      collectHeadings(node.children, out);
    }
  }
}

/**
 * Walks an mdast tree and extracts headings within `[minLevel, maxLevel]`
 * (inclusive), each with a deduplicated anchor id from a fresh
 * per-call `github-slugger` instance.
 *
 * H1 is excluded by default (`minLevel: 2`) because it is the page title,
 * not a section - see D5 in the spec this module implements.
 *
 * @example
 * ```ts
 * const tree = parseMarkdown(source, filePath);
 * const headings = extractHeadings(tree);
 * // [{ id: "goal", text: "Goal", level: 3 }, ...]
 * ```
 */
export function extractHeadings(
  tree: Root,
  options?: { minLevel?: number; maxLevel?: number },
): DocHeading[] {
  const minLevel = options?.minLevel ?? 2;
  const maxLevel = options?.maxLevel ?? 3;

  const headingNodes: Heading[] = [];
  collectHeadings(tree.children, headingNodes);

  const slugger = createHeadingSlugger();

  const headings: DocHeading[] = [];
  for (const node of headingNodes) {
    if (node.depth < minLevel || node.depth > maxLevel) {
      continue;
    }
    const text = mdastToString(node);
    headings.push({
      id: slugger.slug(text),
      text,
      level: node.depth as DocHeading["level"],
    });
  }

  return headings;
}

/**
 * Returns the text of the document's leading H1, or `null` if the tree's
 * first node isn't a depth-1 heading. Only the very first node in the
 * document qualifies - an H1 appearing later is a section heading, not
 * the page title, and must not be treated as one.
 *
 * @example
 * ```ts
 * const tree = parseMarkdown("# Guides\n\nBody.", filePath);
 * extractLeadingH1(tree); // "Guides"
 * ```
 */
export function extractLeadingH1(tree: Root): string | null {
  const first = tree.children[0];
  if (first === undefined || !isHeading(first) || first.depth !== 1) {
    return null;
  }
  return mdastToString(first);
}

/**
 * Removes a leading H1 from markdown source, if present, leaving every
 * other character byte-for-byte untouched. Used to implement D5: the
 * loader returns `content` without the duplicate page-title heading while
 * `rawContent` keeps it.
 *
 * Operates on the node's `position` offsets rather than re-serializing the
 * AST, so formatting quirks elsewhere in the document (link styles, list
 * markers, line wrapping) are never altered.
 *
 * @example
 * ```ts
 * stripLeadingH1("# Guides\n\nBody text."); // "Body text."
 * stripLeadingH1("Body text.");             // "Body text." (no leading H1)
 * ```
 */
export function stripLeadingH1(markdown: string): string {
  const tree = parseMarkdown(markdown, "(stripLeadingH1)");
  const first = tree.children[0];

  if (first === undefined || !isHeading(first) || first.depth !== 1) {
    return markdown;
  }

  const end = first.position?.end.offset;
  if (end === undefined) {
    return markdown;
  }

  return markdown.slice(end).replace(/^(?:[ \t]*\r?\n)+/, "");
}
