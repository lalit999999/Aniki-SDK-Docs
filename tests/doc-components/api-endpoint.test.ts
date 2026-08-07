import { describe, expect, it } from "vitest";
import type { ContainerDirective } from "mdast-util-directive";

import { parseMarkdown } from "@/lib/content/headings";
import { resolveDirective } from "@/lib/doc-components/registry";

function node(source: string): ContainerDirective {
  return parseMarkdown(source, "(test)").children[0] as ContainerDirective;
}

describe("api-endpoint directive", () => {
  it("accepts an uppercase method and a leading-slash path", () => {
    const result = resolveDirective(node(':::api-endpoint{method=GET path="/v1/agents"}\nBody.\n:::\n'));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.attrs.method).toBe("GET");
      expect(result.attrs.path).toBe("/v1/agents");
    }
  });

  it("uppercases a lowercase method", () => {
    const result = resolveDirective(node(':::api-endpoint{method=get path="/v1/agents"}\nBody.\n:::\n'));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.attrs.method).toBe("GET");
    }
  });

  it("accepts every method in the enum, case-insensitively", () => {
    for (const method of ["get", "post", "put", "patch", "delete", "head", "options"]) {
      const result = resolveDirective(
        node(`:::api-endpoint{method=${method} path="/v1/x"}\nBody.\n:::\n`),
      );
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.attrs.method).toBe(method.toUpperCase());
      }
    }
  });

  it("rejects an invalid method with a DIRECTIVE_ATTRIBUTES_INVALID issue", () => {
    const result = resolveDirective(node(':::api-endpoint{method=FETCH path="/v1/agents"}\nBody.\n:::\n'));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("DIRECTIVE_ATTRIBUTES_INVALID");
    }
  });

  it("rejects a path missing its leading slash", () => {
    const result = resolveDirective(node(':::api-endpoint{method=GET path="v1/agents"}\nBody.\n:::\n'));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("DIRECTIVE_ATTRIBUTES_INVALID");
      const issues = result.error.context.issues;
      expect(Array.isArray(issues) && issues.some((issue) => String(issue).includes("/"))).toBe(true);
    }
  });

  it("aggregates both an invalid method and a bad path into one error, not just the first", () => {
    const result = resolveDirective(node(':::api-endpoint{method=FETCH path="v1/agents"}\nBody.\n:::\n'));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      const issues = result.error.context.issues;
      expect(Array.isArray(issues)).toBe(true);
      expect((issues as string[]).length).toBe(2);
    }
  });

  it("parses auth and deprecated as boolean flags", () => {
    const result = resolveDirective(
      node(':::api-endpoint{method=DELETE path="/v1/agents/:id" auth deprecated}\nBody.\n:::\n'),
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.attrs.auth).toBe(true);
      expect(result.attrs.deprecated).toBe(true);
    }
  });

  it("defaults auth and deprecated to undefined when omitted", () => {
    const result = resolveDirective(node(':::api-endpoint{method=GET path="/v1/agents"}\nBody.\n:::\n'));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.attrs.auth).toBeUndefined();
      expect(result.attrs.deprecated).toBeUndefined();
    }
  });
});
