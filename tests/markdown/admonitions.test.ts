/**
 * Unit tests for remark-admonitions, at the hast/HTML level per D15 -
 * this file runs under Vitest's node environment with no jsdom, so
 * assertions are made against serialized HTML, not a rendered React tree.
 */
import { describe, expect, it } from "vitest";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import { toHtml } from "hast-util-to-html";

import remarkAdmonitions from "@/lib/markdown/plugins/remark-admonitions";

function render(markdown: string): string {
  const processor = unified().use(remarkParse).use(remarkAdmonitions).use(remarkRehype);
  return toHtml(processor.runSync(processor.parse(markdown)));
}

describe("remark-admonitions", () => {
  it("converts a marker sharing one text node with its body", () => {
    const html = render("> [!NOTE]\n> Example content\n> more text");
    expect(html).toContain('data-callout="note"');
    expect(html).toContain('data-callout-title="Note"');
    expect(html).toContain("Example content");
    expect(html).toContain("more text");
    expect(html).not.toContain("[!NOTE]");
  });

  it("converts a marker that forms its own paragraph", () => {
    const html = render("> [!TIP]\n>\n> Example content in its own paragraph");
    expect(html).toContain('data-callout="tip"');
    expect(html).toContain('data-callout-title="Tip"');
    expect(html).toContain("Example content in its own paragraph");
    expect(html).not.toContain("[!TIP]");
  });

  it.each([
    ["NOTE", "note", "Note"],
    ["TIP", "tip", "Tip"],
    ["IMPORTANT", "important", "Important"],
    ["WARNING", "warning", "Warning"],
    ["CAUTION", "caution", "Caution"],
  ])("recognises the %s marker", (marker, kind, title) => {
    const html = render(`> [!${marker}]\n> body text`);
    expect(html).toContain(`data-callout="${kind}"`);
    expect(html).toContain(`data-callout-title="${title}"`);
  });

  it("is case-insensitive", () => {
    const html = render("> [!warning]\n> lowercase marker");
    expect(html).toContain('data-callout="warning"');
  });

  it("leaves an unrecognised marker's blockquote untouched", () => {
    const html = render("> [!DANGER]\n> not a recognised kind");
    expect(html).toContain("<blockquote>");
    expect(html).not.toContain("data-callout");
    expect(html).toContain("[!DANGER]");
  });

  it("leaves an ordinary prose blockquote untouched", () => {
    const html = render("> **Note** — just a normal blockquote, not an alert");
    expect(html).toContain("<blockquote>");
    expect(html).not.toContain("data-callout");
    expect(html).toContain("<strong>Note</strong>");
  });

  it("preserves inline markdown formatting in the body", () => {
    const html = render("> [!NOTE]\n> Body with **bold** and a [link](https://example.com).");
    expect(html).toContain("<strong>bold</strong>");
    expect(html).toContain('href="https://example.com"');
  });
});
