import { afterEach, describe, expect, it } from "vitest";
import { z } from "zod";
import type { ContainerDirective, LeafDirective, TextDirective } from "mdast-util-directive";

import { parseMarkdown } from "@/lib/content/headings";
import {
  DOC_COMPONENTS,
  defineDirective,
  issuesFromDirectiveError,
  reconstructTextDirectiveSource,
  resolveDirective,
} from "@/lib/doc-components/registry";
import { DirectiveAttributeError, DirectiveStructureError, UnknownDirectiveError } from "@/lib/doc-components/errors";

function node<T>(source: string): T {
  return parseMarkdown(source, "(test)").children[0] as T;
}

function StubComponent(props: { label?: string; children?: unknown }): null {
  void props;
  return null;
}

const testNames: string[] = [];

function register(name: string, entry: ReturnType<typeof defineDirective>): void {
  DOC_COMPONENTS[name] = entry;
  testNames.push(name);
}

afterEach(() => {
  for (const name of testNames.splice(0)) {
    delete DOC_COMPONENTS[name];
  }
});

describe("resolveDirective", () => {
  it("resolves an unknown directive name to UNKNOWN_DIRECTIVE", () => {
    const container = node<ContainerDirective>(":::totally-unregistered\nBody.\n:::\n");
    const result = resolveDirective(container);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBeInstanceOf(UnknownDirectiveError);
      expect(result.error.code).toBe("UNKNOWN_DIRECTIVE");
    }
  });

  it("resolves a registered container directive, validating and passing through attrs", () => {
    register(
      "stub-card",
      defineDirective({
        kind: "containerDirective",
        schema: z.object({ label: z.string().optional() }),
        component: StubComponent,
      }),
    );
    const container = node<ContainerDirective>(':::stub-card{label="hi"}\nBody.\n:::\n');
    const result = resolveDirective(container);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.name).toBe("stub-card");
      expect(result.attrs).toEqual({ label: "hi" });
      expect(result.label).toBeNull();
    }
  });

  it("extracts the directive label for a registered container directive", () => {
    register(
      "stub-note",
      defineDirective({
        kind: "containerDirective",
        schema: z.object({}),
        component: StubComponent,
      }),
    );
    const container = node<ContainerDirective>(":::stub-note[Heads up]\nBody.\n:::\n");
    const result = resolveDirective(container);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.label).toBe("Heads up");
    }
  });

  it("fails with DIRECTIVE_ATTRIBUTES_INVALID and every issue when the schema rejects", () => {
    register(
      "stub-strict",
      defineDirective({
        kind: "containerDirective",
        schema: z.object({ a: z.string(), b: z.string() }),
        component: StubComponent,
      }),
    );
    const container = node<ContainerDirective>(":::stub-strict\nBody.\n:::\n");
    const result = resolveDirective(container);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBeInstanceOf(DirectiveAttributeError);
      expect(result.error.code).toBe("DIRECTIVE_ATTRIBUTES_INVALID");
      const issues = issuesFromDirectiveError(result.error);
      expect(issues).toHaveLength(2);
    }
  });

  it("fails with DIRECTIVE_STRUCTURE_INVALID when written with the wrong directive syntax", () => {
    register(
      "stub-leaf-only",
      defineDirective({
        kind: "leafDirective",
        schema: z.object({}),
        component: StubComponent,
      }),
    );
    // Written as a container (`:::`) even though it's registered as a leaf.
    const container = node<ContainerDirective>(":::stub-leaf-only\nBody.\n:::\n");
    const result = resolveDirective(container);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBeInstanceOf(DirectiveStructureError);
      expect(result.error.code).toBe("DIRECTIVE_STRUCTURE_INVALID");
    }
  });

  it("fails with DIRECTIVE_STRUCTURE_INVALID when a child isn't in allowedChildren", () => {
    register(
      "stub-tabs",
      defineDirective({
        kind: "containerDirective",
        schema: z.object({}),
        component: StubComponent,
        allowedChildren: ["stub-tab"],
      }),
    );
    const container = node<ContainerDirective>(":::stub-tabs\nA stray paragraph.\n:::\n");
    const result = resolveDirective(container);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBeInstanceOf(DirectiveStructureError);
      const issues = issuesFromDirectiveError(result.error);
      expect(issues[0]).toContain("D7");
    }
  });

  it("resolves a registered leaf directive", () => {
    register(
      "stub-install",
      defineDirective({
        kind: "leafDirective",
        schema: z.object({ name: z.string() }),
        component: StubComponent,
      }),
    );
    const leaf = node<LeafDirective>('::stub-install{name="aniki-sdk"}\n');
    const result = resolveDirective(leaf);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.attrs).toEqual({ name: "aniki-sdk" });
    }
  });
});

describe("reconstructTextDirectiveSource", () => {
  it("reconstructs a bare name with no attributes", () => {
    const tree = parseMarkdown("See foo:bar for details.\n", "(test)");
    const paragraph = tree.children[0] as { children: unknown[] };
    const textDirective = paragraph.children.find(
      (child): child is TextDirective => (child as { type: string }).type === "textDirective",
    );
    expect(textDirective).toBeDefined();
    if (textDirective !== undefined) {
      expect(reconstructTextDirectiveSource(textDirective)).toBe(":bar");
    }
  });

  it("reconstructs attributes, using bare keys for empty-string flags", () => {
    const fake: TextDirective = {
      type: "textDirective",
      name: "badge",
      attributes: { variant: "outline", dev: "" },
      children: [],
    };
    expect(reconstructTextDirectiveSource(fake)).toBe(':badge{variant="outline" dev}');
  });
});

describe("issuesFromDirectiveError", () => {
  it("falls back to the error's own message when context has no issues array", () => {
    const error = new UnknownDirectiveError('unknown directive ":foo"', {
      name: "foo",
      kind: "textDirective",
    });
    expect(issuesFromDirectiveError(error)).toEqual(['unknown directive ":foo"']);
  });
});
