import { describe, expect, it } from "vitest";
import type { ContainerDirective } from "mdast-util-directive";

import { parseMarkdown } from "@/lib/content/headings";
import { resolveDirective } from "@/lib/doc-components/registry";
import { DirectiveAttributeError } from "@/lib/doc-components/errors";
import { CALLOUT_TYPES } from "@/components/docs-ui/callout";

function container(source: string): ContainerDirective {
  return parseMarkdown(source, "(test)").children[0] as ContainerDirective;
}

describe("callout directive", () => {
  it.each(CALLOUT_TYPES)("resolves :::callout{type=%s}", (type) => {
    const node = container(`:::callout{type=${type}}\nBody.\n:::\n`);
    const result = resolveDirective(node);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.attrs.type).toBe(type);
    }
  });

  it("rejects an invalid type with DIRECTIVE_ATTRIBUTES_INVALID", () => {
    const node = container(":::callout{type=nonsense}\nBody.\n:::\n");
    const result = resolveDirective(node);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBeInstanceOf(DirectiveAttributeError);
      expect(result.error.code).toBe("DIRECTIVE_ATTRIBUTES_INVALID");
      const { issues } = result.error.context as { issues: readonly string[] };
      expect(issues.length).toBeGreaterThan(0);
      expect(issues[0]).toContain("type");
    }
  });

  it.each(CALLOUT_TYPES)("resolves the :::%s alias with the matching default type", (type) => {
    const node = container(`:::${type}\nBody.\n:::\n`);
    const result = resolveDirective(node);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.attrs.type).toBe(type);
    }
  });

  it("lets an alias's type be explicitly overridden", () => {
    const node = container(":::note{type=danger}\nBody.\n:::\n");
    const result = resolveDirective(node);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.attrs.type).toBe("danger");
    }
  });

  it("uses the title attribute when given", () => {
    const node = container(':::note{title="Custom title"}\nBody.\n:::\n');
    const result = resolveDirective(node);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.attrs.title).toBe("Custom title");
    }
  });

  it("falls back to the directive label when there is no title attribute", () => {
    const node = container(":::note[From the label]\nBody.\n:::\n");
    const result = resolveDirective(node);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.label).toBe("From the label");
      expect(result.attrs.title).toBe("From the label");
    }
  });

  it("prefers the title attribute over the directive label when both are given", () => {
    const node = container(':::note[From the label]{title="From the attribute"}\nBody.\n:::\n');
    const result = resolveDirective(node);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.label).toBe("From the label");
      expect(result.attrs.title).toBe("From the attribute");
    }
  });

  it("has no title at all when neither an attribute nor a label is given", () => {
    const node = container(":::note\nBody.\n:::\n");
    const result = resolveDirective(node);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.attrs.title).toBeUndefined();
    }
  });
});
