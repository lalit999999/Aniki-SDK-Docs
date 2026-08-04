/**
 * Unit tests for remark-callouts, at the hast/HTML level (D15).
 */
import { describe, expect, it } from "vitest";
import { unified } from "unified";
import remarkDirective from "remark-directive";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import { toHtml } from "hast-util-to-html";

import remarkCallouts from "@/lib/markdown/plugins/remark-callouts";

function render(markdown: string): string {
  const processor = unified().use(remarkParse).use(remarkDirective).use(remarkCallouts).use(remarkRehype);
  return toHtml(processor.runSync(processor.parse(markdown)));
}

describe("remark-callouts", () => {
  it("uses the [Label] title when present", () => {
    const html = render(":::tip[Custom title]\nBody with **markdown**.\n:::");
    expect(html).toContain('data-callout="tip"');
    expect(html).toContain('data-callout-title="Custom title"');
    expect(html).toContain("<strong>markdown</strong>");
    expect(html).not.toContain("Custom title</p>");
  });

  it("falls back to the attribute title when there is no label", () => {
    const html = render(':::tip{title="Attribute title"}\nBody.\n:::');
    expect(html).toContain('data-callout-title="Attribute title"');
  });

  it("falls back to the kind's default title when neither is given", () => {
    const html = render(":::warning\nUses the default title for its kind.\n:::");
    expect(html).toContain('data-callout="warning"');
    expect(html).toContain('data-callout-title="Warning"');
  });

  it.each([
    ["note", "note"],
    ["tip", "tip"],
    ["important", "important"],
    ["warning", "warning"],
    ["caution", "caution"],
  ])("recognises the %s kind directly", (name, kind) => {
    const html = render(`:::${name}\nbody\n:::`);
    expect(html).toContain(`data-callout="${kind}"`);
  });

  it.each([
    ["info", "note"],
    ["success", "tip"],
    ["danger", "caution"],
  ])("maps the %s alias to %s", (alias, kind) => {
    const html = render(`:::${alias}\nbody\n:::`);
    expect(html).toContain(`data-callout="${kind}"`);
  });

  it("leaves an unrecognised directive name untouched", () => {
    const html = render(":::not-a-known-kind\nleft alone.\n:::");
    expect(html).not.toContain("data-callout");
    expect(html).toContain("<div>");
    expect(html).toContain("left alone.");
  });
});
