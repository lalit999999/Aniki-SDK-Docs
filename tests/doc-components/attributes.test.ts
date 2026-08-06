import { describe, expect, it } from "vitest";
import type { Paragraph } from "mdast";
import type { ContainerDirective } from "mdast-util-directive";

import { parseMarkdown } from "@/lib/content/headings";
import {
  directiveBoolean,
  directiveList,
  directiveNumber,
  extractDirectiveLabel,
  formatDirectiveIssues,
  toAttributeRecord,
} from "@/lib/doc-components/attributes";

function containerOf(source: string): ContainerDirective {
  const tree = parseMarkdown(source, "(test)");
  return tree.children[0] as ContainerDirective;
}

describe("toAttributeRecord", () => {
  it("returns the directive's attributes as a plain string record", () => {
    const container = containerOf(':::callout{type="warning" title="Careful"}\nBody.\n:::\n');
    expect(toAttributeRecord(container)).toEqual({ type: "warning", title: "Careful" });
  });

  it("returns an empty record for a directive with no attributes", () => {
    const container = containerOf(":::note\nBody.\n:::\n");
    expect(toAttributeRecord(container)).toEqual({});
  });

  it("drops null/undefined attribute values", () => {
    const container = containerOf(":::note\nBody.\n:::\n");
    container.attributes = { kept: "yes", dropped: null, alsoDropped: undefined };
    expect(toAttributeRecord(container)).toEqual({ kept: "yes" });
  });
});

describe("directiveBoolean", () => {
  const schema = directiveBoolean();

  it.each(["", "true", "yes", "1", "on"])("coerces %j to true", (value) => {
    expect(schema.parse(value)).toBe(true);
  });

  it.each(["false", "no", "0", "off"])("coerces %j to false", (value) => {
    expect(schema.parse(value)).toBe(false);
  });

  it("rejects an unrecognized value", () => {
    expect(schema.safeParse("maybe").success).toBe(false);
  });
});

describe("directiveNumber", () => {
  const schema = directiveNumber();

  it("parses a finite numeric string", () => {
    expect(schema.parse("3")).toBe(3);
    expect(schema.parse("3.5")).toBe(3.5);
  });

  it("rejects a non-numeric string", () => {
    expect(schema.safeParse("abc").success).toBe(false);
  });

  it("rejects a non-finite result (Infinity, NaN)", () => {
    expect(schema.safeParse("Infinity").success).toBe(false);
    expect(schema.safeParse("NaN").success).toBe(false);
  });
});

describe("directiveList", () => {
  const schema = directiveList();

  it("splits on commas, trimming each entry", () => {
    expect(schema.parse("react, vue, node")).toEqual(["react", "vue", "node"]);
  });

  it("splits on whitespace", () => {
    expect(schema.parse("react vue node")).toEqual(["react", "vue", "node"]);
  });

  it("drops empty entries from mixed/repeated separators", () => {
    expect(schema.parse("react,, vue,   node,")).toEqual(["react", "vue", "node"]);
  });
});

describe("extractDirectiveLabel", () => {
  it("extracts the directive label and strips it from the body", () => {
    const container = containerOf(":::note[Heads up]\nBody text.\n:::\n");
    const { label, children } = extractDirectiveLabel(container);
    expect(label).toBe("Heads up");
    expect(children).toHaveLength(1);
    expect(children[0]?.type).toBe("paragraph");
  });

  it("returns a null label and the full body when there is no label", () => {
    const container = containerOf(":::note\nBody text.\n:::\n");
    const { label, children } = extractDirectiveLabel(container);
    expect(label).toBeNull();
    expect(children).toEqual(container.children);
  });

  it("does not mistake an ordinary first paragraph for a label", () => {
    const container = containerOf(":::note\nJust a normal paragraph.\n:::\n");
    const [first] = container.children as Paragraph[];
    expect(first?.data?.directiveLabel).toBeUndefined();
    const { label } = extractDirectiveLabel(container);
    expect(label).toBeNull();
  });
});

describe("formatDirectiveIssues", () => {
  it("formats each issue as \"path: message\"", () => {
    const result = directiveNumber().safeParse("abc");
    expect(result.success).toBe(false);
    if (!result.success) {
      const formatted = formatDirectiveIssues(result.error);
      expect(formatted).toHaveLength(1);
      expect(formatted[0]).toContain("(root):");
    }
  });
});
