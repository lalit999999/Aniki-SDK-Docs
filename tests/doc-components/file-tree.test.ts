import { describe, expect, it } from "vitest";
import type { List } from "mdast";

import { parseMarkdown } from "@/lib/content/headings";
import { parseFileTree } from "@/lib/doc-components/file-tree";

function bodyOf(source: string) {
  return parseMarkdown(source, "(test)").children;
}

describe("parseFileTree", () => {
  it("parses a flat list of files", () => {
    const result = parseFileTree(bodyOf("- package.json\n- README.md\n"));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.nodes).toEqual([
        { name: "package.json", kind: "file", highlighted: false, children: [] },
        { name: "README.md", kind: "file", highlighted: false, children: [] },
      ]);
    }
  });

  it("treats a trailing-slash entry as a folder even with no nested list", () => {
    const result = parseFileTree(bodyOf("- public/\n"));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.nodes).toEqual([{ name: "public", kind: "folder", highlighted: false, children: [] }]);
    }
  });

  it("parses deep nesting, mixed ordered and unordered lists", () => {
    const result = parseFileTree(
      bodyOf("- src/\n  1. app/\n     - page.tsx\n  2. lib/\n"),
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.nodes).toHaveLength(1);
      const [src] = result.nodes;
      expect(src?.kind).toBe("folder");
      expect(src?.children.map((child) => child.name)).toEqual(["app", "lib"]);
      const app = src?.children[0];
      expect(app?.kind).toBe("folder");
      expect(app?.children).toEqual([{ name: "page.tsx", kind: "file", highlighted: false, children: [] }]);
    }
  });

  it("marks a **bold** entry name as highlighted", () => {
    const result = parseFileTree(bodyOf("- **index.ts**\n- other.ts\n"));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.nodes[0]).toEqual({ name: "index.ts", kind: "file", highlighted: true, children: [] });
      expect(result.nodes[1]?.highlighted).toBe(false);
    }
  });

  it("fails with an issue naming an empty body", () => {
    const result = parseFileTree([]);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues[0]).toContain("empty body");
    }
  });

  it("fails with an issue naming a paragraph instead of a list", () => {
    const result = parseFileTree(bodyOf("Just a paragraph.\n"));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues[0]).toContain('"paragraph"');
    }
  });

  it("fails when the body has more than one block", () => {
    const result = parseFileTree(bodyOf("- a\n- b\n\nAnother paragraph.\n"));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues[0]).toContain("2 block-level elements");
    }
  });

  it("parses an ordered list the same as an unordered one", () => {
    const [list] = bodyOf("1. a\n2. b\n") as [List];
    expect(list.ordered).toBe(true);
    const result = parseFileTree([list]);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.nodes.map((node) => node.name)).toEqual(["a", "b"]);
    }
  });
});
