/**
 * Proves D2: rendering `doc.content` (never `doc.rawContent`) through the
 * markdown pipeline produces H2/H3 ids identical to `doc.headings[].id`
 * for every real document, across all 16 files in content/docs. If this
 * ever fails, the table of contents a future step builds against
 * `doc.headings` is silently disconnected from the ids anchors actually
 * carry in the rendered page.
 *
 * Follows the existing content-test convention of importing from
 * `@/lib/content/loader` rather than the `@/lib/content` barrel, which
 * imports `server-only` and throws outside an RSC context.
 */
import { describe, expect, it } from "vitest";
import type { Element, Nodes } from "hast";

import { getAllDocs } from "@/lib/content/loader";
import { renderMarkdownToHast } from "@/lib/markdown/pipeline";

const HEADING_TAGS = new Set(["h2", "h3"]);

function collectHeadingIds(tree: Nodes, out: string[]): void {
  if (tree.type === "element" && HEADING_TAGS.has(tree.tagName)) {
    const id = (tree as Element).properties.id;
    if (typeof id === "string") {
      out.push(id);
    }
  }
  if ("children" in tree) {
    for (const child of tree.children) {
      collectHeadingIds(child, out);
    }
  }
}

describe("heading id parity between lib/content and lib/markdown", () => {
  it(
    "matches doc.headings[].id for every real document in content/docs",
    async () => {
      const docs = await getAllDocs();
      expect(docs.length).toBe(16);

      for (const doc of docs) {
        const hast = await renderMarkdownToHast(doc.content, { filePath: doc.meta.filePath });
        const renderedIds: string[] = [];
        collectHeadingIds(hast, renderedIds);

        const expectedIds = doc.headings
          .filter((heading) => heading.level === 2 || heading.level === 3)
          .map((heading) => heading.id);

        expect(renderedIds, `heading ids for ${doc.meta.filePath}`).toEqual(expectedIds);
      }
    },
    30_000,
  );
});
