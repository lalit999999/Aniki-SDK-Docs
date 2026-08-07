/**
 * The definition of done for the interactive documentation component
 * library (Step 8). Three things, in increasing order of importance:
 *
 * 1. Every directive the showcase page (`/docs/components`) uses actually
 *    resolves - a broken example on the one page meant to demonstrate the
 *    whole library would be an unusually embarrassing place for a typo to
 *    survive.
 * 2. Every family registered in `DOC_COMPONENTS` is demonstrated on that
 *    page at least once, so the showcase can't quietly drift out of date
 *    as the library grows - a new component that never makes it into
 *    `components.md` fails this test immediately instead of just being
 *    forgotten.
 * 3. Every directive anywhere in the *whole* content corpus resolves, not
 *    just the showcase page. This is the guard against the mid-word
 *    text-directive hazard (§3.1 of the Step 8 brief): `foo:bar` in
 *    ordinary prose parses as a directive named `bar` and silently drops
 *    the word "bar" from the rendered page. An unregistered text
 *    directive degrades gracefully at render time (D5) - which is exactly
 *    why this failure mode is invisible until a reader notices text
 *    missing. This assertion is what catches it in CI instead.
 *
 * `vitest.config.ts`'s `ssr.resolve.conditions: ["react-server"]` is what
 * lets this file import `@/lib/content/loader` (a `server-only` module)
 * directly, the same way `tests/content/integrity.test.ts` does.
 */
import { beforeEach, describe, expect, it } from "vitest";

import { clearContentCache, getAllDocs, getDocBySlug } from "@/lib/content/loader";
import { parseMarkdown } from "@/lib/content/headings";
import { DOC_COMPONENTS, resolveDirective } from "@/lib/doc-components";
import type { DirectiveNode } from "@/lib/doc-components";

const DIRECTIVE_TYPES = new Set(["containerDirective", "leafDirective", "textDirective"]);

/**
 * Walks an already-parsed mdast tree collecting every directive node,
 * however deeply nested - inside a container's body, inside a list item,
 * or inline inside a paragraph's phrasing content (where a `:badge[...]`
 * text directive actually lives). Every mdast node that can contain other
 * nodes exposes them as a `children` array regardless of its specific
 * type, so recursing on that shape generically finds every directive
 * without needing a case for each of the dozen node types that could
 * contain one.
 */
function collectDirectives(nodes: readonly unknown[], found: DirectiveNode[]): void {
  for (const node of nodes) {
    if (node === null || typeof node !== "object") {
      continue;
    }
    const record = node as { type?: string; children?: unknown[] };
    if (typeof record.type === "string" && DIRECTIVE_TYPES.has(record.type)) {
      found.push(node as DirectiveNode);
    }
    if (Array.isArray(record.children)) {
      collectDirectives(record.children, found);
    }
  }
}

function describeFailure(node: DirectiveNode, error: { code: string; message: string }): string {
  const syntax = node.type === "containerDirective" ? ":::" : node.type === "leafDirective" ? "::" : ":";
  return `${syntax}${node.name} (${error.code}): ${error.message}`;
}

beforeEach(() => {
  clearContentCache();
});

describe("component showcase", () => {
  it("resolves every directive on the showcase page with zero failures", async () => {
    const doc = await getDocBySlug("components");
    const tree = parseMarkdown(doc.content, doc.meta.filePath);
    const directives: DirectiveNode[] = [];
    collectDirectives(tree.children, directives);

    // A showcase with no directives at all would make every other
    // assertion in this file vacuously true - fail loudly instead.
    expect(directives.length).toBeGreaterThan(0);

    const failures: string[] = [];
    for (const node of directives) {
      const result = resolveDirective(node);
      if (!result.ok) {
        failures.push(describeFailure(node, result.error));
      }
    }

    expect(failures).toEqual([]);
  });

  it("demonstrates every registered directive family at least once", async () => {
    const doc = await getDocBySlug("components");
    const tree = parseMarkdown(doc.content, doc.meta.filePath);
    const directives: DirectiveNode[] = [];
    collectDirectives(tree.children, directives);
    const usedNames = new Set(directives.map((node) => node.name));

    const registeredNames = Object.keys(DOC_COMPONENTS);
    expect(registeredNames.length).toBeGreaterThan(0);

    const missing = registeredNames.filter((name) => !usedNames.has(name));
    expect(missing).toEqual([]);
  });

  it("resolves every directive across the whole content corpus", async () => {
    const docs = await getAllDocs();
    expect(docs.length).toBeGreaterThan(0);

    const failures: string[] = [];
    for (const doc of docs) {
      const tree = parseMarkdown(doc.content, doc.meta.filePath);
      const directives: DirectiveNode[] = [];
      collectDirectives(tree.children, directives);

      for (const node of directives) {
        const result = resolveDirective(node);
        if (!result.ok) {
          failures.push(`${doc.meta.slug} - ${describeFailure(node, result.error)}`);
        }
      }
    }

    expect(failures).toEqual([]);
  });
});
