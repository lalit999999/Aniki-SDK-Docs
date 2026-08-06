/**
 * Verifies the directive-parsing foundation against the exact behaviours
 * documented for `remark-directive@4` + `unified@11` + `remark-parse@11`
 * (the versions this repo resolves) - every row is a guard against a
 * silent upgrade changing how content authors' directive syntax parses.
 */
import { describe, expect, it } from "vitest";
import { toString as mdastToString } from "mdast-util-to-string";
import type { Code, Paragraph, Root } from "mdast";
import type { ContainerDirective, LeafDirective, TextDirective } from "mdast-util-directive";

import { parseMarkdown } from "@/lib/content/headings";
import { isContainerDirective, isLeafDirective, isTextDirective } from "@/lib/doc-components/types";

function parse(source: string): Root {
  return parseMarkdown(source, "(test)");
}

describe("directive parsing", () => {
  it("parses a container directive with a label paragraph", () => {
    const tree = parse(":::note[Heads up]\nBody text.\n:::\n");
    const node = tree.children[0];
    expect(isContainerDirective(node)).toBe(true);
    const container = node as ContainerDirective;
    expect(container.name).toBe("note");
    const [label] = container.children;
    expect(label?.type).toBe("paragraph");
    expect((label as Paragraph).data?.directiveLabel).toBe(true);
    expect(mdastToString(label as Paragraph)).toBe("Heads up");
  });

  it("nests a 4-colon container around a 3-colon container correctly", () => {
    const tree = parse('::::tabs{sync="pkg"}\n:::tab{label="npm"}\nnpm install\n:::\n::::\n');
    const outer = tree.children[0] as ContainerDirective;
    expect(outer.type).toBe("containerDirective");
    expect(outer.name).toBe("tabs");
    expect(outer.attributes).toEqual({ sync: "pkg" });
    const inner = outer.children[0] as ContainerDirective;
    expect(inner.type).toBe("containerDirective");
    expect(inner.name).toBe("tab");
  });

  it("closes an outer 3-colon container early when nested under a 3-colon container (D7 authoring mistake)", () => {
    const tree = parse(':::tabs\n:::tab{label="npm"}\nnpm install\n:::\n:::\n');
    const outer = tree.children[0] as ContainerDirective;
    expect(outer.name).toBe("tabs");
    const trailing = tree.children[tree.children.length - 1] as Paragraph;
    expect(trailing.type).toBe("paragraph");
    expect(mdastToString(trailing)).toBe(":::");
  });

  it("parses a leaf directive's attributes, including a bare boolean flag", () => {
    const tree = parse('::package-install{name="aniki-sdk" dev}\n');
    const node = tree.children[0];
    expect(isLeafDirective(node)).toBe(true);
    const leaf = node as LeafDirective;
    expect(leaf.attributes).toEqual({ name: "aniki-sdk", dev: "" });
  });

  it("parses a text directive with a label as its inline content", () => {
    const tree = parse(":badge[Beta]{variant=outline}\n");
    const paragraph = tree.children[0] as Paragraph;
    const [child] = paragraph.children;
    expect(isTextDirective(child)).toBe(true);
    const textDirective = child as TextDirective;
    expect(textDirective.name).toBe("badge");
    expect(textDirective.attributes).toEqual({ variant: "outline" });
    expect(mdastToString(textDirective)).toBe("Beta");
  });

  it("maps #id and .class shorthand plus explicit attributes, all as strings", () => {
    const tree = parse(":::card{#hero .wide count=3}\nBody.\n:::\n");
    const container = tree.children[0] as ContainerDirective;
    expect(container.attributes).toEqual({ id: "hero", class: "wide", count: "3" });
  });

  it("gives a fenced code block its lang and full meta string", () => {
    const tree = parse('```ts title="agent.ts" showLineNumbers {3-5}\nconst x = 1;\n```\n');
    const code = tree.children[0] as Code;
    expect(code.lang).toBe("ts");
    expect(code.meta).toBe('title="agent.ts" showLineNumbers {3-5}');
  });

  it("makes a fenced code block inside a container a direct child, no wrapper paragraph", () => {
    const tree = parse(':::tab{label="npm"}\n```bash\nnpm install\n```\n:::\n');
    const container = tree.children[0] as ContainerDirective;
    expect(container.children).toHaveLength(1);
    expect(container.children[0]?.type).toBe("code");
  });

  it("leaves a text directive inert inside inline code", () => {
    const tree = parse("Use `tool:error` to signal failure.\n");
    const paragraph = tree.children[0] as Paragraph;
    const inlineCode = paragraph.children.find((child) => child.type === "inlineCode");
    expect(inlineCode).toMatchObject({ type: "inlineCode", value: "tool:error" });
    expect(paragraph.children.some((child) => child.type === "textDirective")).toBe(false);
  });

  it("leaves colons inside fenced code untouched", () => {
    const tree = parse('```txt\n:::not-a-directive\n:another:one:\n```\n');
    const code = tree.children[0] as Code;
    expect(code.type).toBe("code");
    expect(code.value).toBe(":::not-a-directive\n:another:one:");
  });

  it("fires a text directive mid-word in bare prose (documented parser trap)", () => {
    const tree = parse("See foo:bar for details.\n");
    const paragraph = tree.children[0] as Paragraph;
    const hasTextDirective = paragraph.children.some((child) => child.type === "textDirective");
    expect(hasTextDirective).toBe(true);
    // The word "bar" is consumed as the (unregistered) directive's name
    // and produces no visible text of its own - exactly why T2's fallback
    // must reconstruct source text for a childless text directive instead
    // of trusting `node.children` to hold something renderable.
    expect(mdastToString(paragraph)).not.toContain("bar");
  });
});
