/**
 * End-to-end test of the full unified pipeline, including real Shiki
 * highlighting, over content/samples/kitchen-sink.md. Shiki's first
 * grammar load is slow enough to exceed Vitest's default 5s timeout, so
 * this suite raises it to 30s.
 */
import path from "node:path";
import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { toHtml } from "hast-util-to-html";

import { renderMarkdownToHast } from "@/lib/markdown/pipeline";

const FIXTURE_PATH = path.join(process.cwd(), "content", "samples", "kitchen-sink.md");
const TIMEOUT_MS = 30_000;

async function renderFixture(): Promise<string> {
  const markdown = await readFile(FIXTURE_PATH, "utf-8");
  const hast = await renderMarkdownToHast(markdown, {
    filePath: "content/samples/kitchen-sink.md",
  });
  return toHtml(hast);
}

describe("markdown pipeline", () => {
  it(
    "highlights code with dual-theme Shiki tokens",
    async () => {
      const html = await renderFixture();
      expect(html).toContain("--shiki-light");
      expect(html).toContain("--shiki-dark");
    },
    TIMEOUT_MS,
  );

  it(
    "captures raw source on every code block figure",
    async () => {
      const html = await renderFixture();
      expect(html).toContain("data-rehype-pretty-code-figure");
      expect(html).toContain("data-raw=");
    },
    TIMEOUT_MS,
  );

  it(
    "renders GFM tables and task lists",
    async () => {
      const html = await renderFixture();
      expect(html).toContain("<table>");
      expect(html).toContain("contains-task-list");
      expect(html).toContain('type="checkbox"');
    },
    TIMEOUT_MS,
  );

  it(
    "renders every admonition and callout kind as an aside",
    async () => {
      const html = await renderFixture();
      for (const kind of ["note", "tip", "important", "warning", "caution"]) {
        expect(html).toContain(`data-callout="${kind}"`);
      }
    },
    TIMEOUT_MS,
  );

  it(
    "leaves the unrecognised directive in the fixture untouched",
    async () => {
      const html = await renderFixture();
      expect(html).toContain("This directive isn't a recognised callout kind");
    },
    TIMEOUT_MS,
  );

  it(
    "rewrites the fixture's relative link and flags its unresolvable one",
    async () => {
      const html = await renderFixture();
      expect(html).toContain('href="/docs/tools"');
      expect(html).toContain("href=\"/docs/this-document-does-not-exist\"");
    },
    TIMEOUT_MS,
  );

  it(
    "produces heading ids for every H2 in the fixture",
    async () => {
      const html = await renderFixture();
      expect(html).toContain('id="heading-level-two"');
      expect(html).toContain('id="lists"');
    },
    TIMEOUT_MS,
  );
});
