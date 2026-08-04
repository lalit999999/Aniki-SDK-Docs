/**
 * Unit tests for rehype-doc-links, covering every row of the D13 table
 * plus the `knownSlugs` / `data-unresolved` behavior.
 */
import { describe, expect, it } from "vitest";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import { toHtml } from "hast-util-to-html";

import rehypeDocLinks from "@/lib/markdown/plugins/rehype-doc-links";

function render(markdown: string, knownSlugs?: readonly string[]): string {
  const processor = unified().use(remarkParse).use(remarkRehype).use(rehypeDocLinks, { knownSlugs });
  return toHtml(processor.runSync(processor.parse(markdown)));
}

describe("rehype-doc-links", () => {
  it("rewrites ./tools.md to /docs/tools", () => {
    expect(render("[a](./tools.md)")).toContain('href="/docs/tools"');
  });

  it("preserves an anchor fragment on a rewritten link", () => {
    const html = render("[a](./tools.md#the-openai-limitation)");
    expect(html).toContain('href="/docs/tools#the-openai-limitation"');
  });

  it("maps ./README.md to /docs", () => {
    expect(render("[a](./README.md)")).toContain('href="/docs"');
  });

  it("leaves a bare #anchor unchanged", () => {
    expect(render("[a](#anchor)")).toContain('href="#anchor"');
  });

  it("leaves an absolute /path unchanged", () => {
    expect(render("[a](/anything)")).toContain('href="/anything"');
  });

  it("annotates an external https:// link and keeps its href intact", () => {
    const html = render("[a](https://example.com)");
    expect(html).toContain('href="https://example.com"');
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer"');
    expect(html).toContain("data-external");
  });

  it("leaves mailto: links unchanged", () => {
    expect(render("[a](mailto:x@example.com)")).toContain('href="mailto:x@example.com"');
  });

  it("leaves tel: links unchanged", () => {
    expect(render("[a](tel:+1234567890)")).toContain('href="tel:+1234567890"');
  });

  it("never throws on unparseable link text", () => {
    expect(() => render("plain text with no links at all")).not.toThrow();
  });

  it("marks a rewritten link data-unresolved when its slug isn't known", () => {
    const html = render("[a](./missing-doc.md)", ["tools", "index"]);
    expect(html).toContain('href="/docs/missing-doc"');
    expect(html).toContain("data-unresolved");
  });

  it("does not mark a rewritten link data-unresolved when its slug is known", () => {
    const html = render("[a](./tools.md)", ["tools", "index"]);
    expect(html).not.toContain("data-unresolved");
  });

  it("does not require knownSlugs at all", () => {
    const html = render("[a](./tools.md)");
    expect(html).toContain('href="/docs/tools"');
    expect(html).not.toContain("data-unresolved");
  });
});
