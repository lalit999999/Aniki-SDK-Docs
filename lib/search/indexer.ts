/**
 * Section-level search index builder.
 *
 * The only server-only module in `lib/search` - it is the sole caller of
 * `@/lib/content` in this directory, and `lib/search/index.ts` must never
 * re-export it (D2), or every client import of the barrel would pull in
 * `node:fs` and fail the build. Only `app/api/search-index/route.ts`
 * (a Server Component / route handler) may import this file.
 */

import "server-only";

import type { Heading, Root, RootContent } from "mdast";

import { extractProse, getAllDocs, parseMarkdown } from "@/lib/content";
import type { Doc, DocHeading } from "@/lib/content/types";

import type { SearchIndex, SearchSection } from "./types";
import { SEARCH_INDEX_VERSION } from "./types";

/**
 * Character cap for a section's indexed `content`. `api-reference.md` is
 * over a thousand lines and predominantly code; without a cap, its prose
 * sections would balloon the served index far past what improves recall
 * (D4).
 */
export const SECTION_CONTENT_LIMIT = 1200;

function isHeading(node: RootContent): node is Heading {
  return node.type === "heading" && node.depth >= 2 && node.depth <= 4;
}

interface RawSection {
  heading: Heading | null;
  nodes: RootContent[];
}

/**
 * Cuts a document's top-level nodes into runs starting at each H2-H4
 * heading, with any content before the first heading becoming a `heading:
 * null` lead section. Only top-level nodes are inspected for cut points -
 * a heading node cannot appear nested inside another block in a
 * well-formed mdast tree.
 */
function splitIntoRawSections(tree: Root): RawSection[] {
  const sections: RawSection[] = [{ heading: null, nodes: [] }];

  for (const node of tree.children) {
    if (isHeading(node)) {
      sections.push({ heading: node, nodes: [] });
      continue;
    }
    const current = sections[sections.length - 1];
    if (current !== undefined) {
      current.nodes.push(node);
    }
  }

  return sections;
}

function narrowSectionHeadingLevel(level: DocHeading["level"] | undefined): 2 | 3 | 4 | null {
  if (level === 2 || level === 3 || level === 4) {
    return level;
  }
  return null;
}

function truncateAtWordBoundary(text: string, limit: number): string {
  if (text.length <= limit) {
    return text;
  }
  const slice = text.slice(0, limit);
  const lastSpace = slice.lastIndexOf(" ");
  const boundary = lastSpace > limit * 0.5 ? lastSpace : limit;
  return slice.slice(0, boundary).trimEnd();
}

function extractSectionContent(nodes: RootContent[]): string {
  const sectionRoot: Root = { type: "root", children: nodes };
  const prose = extractProse(sectionRoot, { includeCode: false });
  return truncateAtWordBoundary(prose, SECTION_CONTENT_LIMIT);
}

/**
 * Builds every `SearchSection` for a single document, consuming
 * `doc.headings` in order to attach anchor ids - the same queue technique
 * `DocsContent` uses to line up rendered headings with parsed ones -
 * rather than re-slugging heading text, which could diverge from the
 * actual rendered anchor (e.g. on a duplicate heading `github-slugger`
 * disambiguates as `goal-1`).
 */
function buildDocSections(doc: Doc): SearchSection[] {
  const tree = parseMarkdown(doc.content, doc.meta.filePath);
  const rawSections = splitIntoRawSections(tree);
  const headingQueue: DocHeading[] = [...doc.headings];

  const sections: SearchSection[] = [];
  let order = 0;

  for (const raw of rawSections) {
    const heading = raw.heading !== null ? headingQueue.shift() ?? null : null;
    const content = extractSectionContent(raw.nodes);

    if (raw.heading === null && content.length === 0) {
      // Lead section with no prose before the first heading: nothing to index.
      continue;
    }

    const headingId = heading?.id ?? null;
    const href = headingId !== null ? `${doc.meta.route}#${headingId}` : doc.meta.route;

    sections.push({
      id: `${doc.meta.slug}#${headingId ?? "lead"}`,
      docSlug: doc.meta.slug,
      docTitle: doc.meta.title,
      docDescription: doc.meta.description,
      category: doc.meta.category,
      route: doc.meta.route,
      href,
      headingId,
      headingText: heading?.text ?? null,
      headingLevel: narrowSectionHeadingLevel(heading?.level),
      content,
      order: order++,
    });
  }

  return sections;
}

/**
 * Builds the complete section-level search index across every visible
 * document. Errors from the content layer (a malformed frontmatter block,
 * an unparsable markdown file) propagate unchanged - a broken document
 * must fail the build loudly rather than silently producing a half-index
 * that quietly can't find that page.
 *
 * @example
 * ```ts
 * const index = await buildSearchIndex();
 * index.sections.length; // a few hundred, across 16 documents
 * ```
 */
export async function buildSearchIndex(): Promise<SearchIndex> {
  const docs = await getAllDocs();
  const sections = docs.flatMap((doc) => buildDocSections(doc));

  return {
    version: SEARCH_INDEX_VERSION,
    generatedAt: new Date().toISOString(),
    sections,
  };
}
