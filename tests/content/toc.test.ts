import { describe, expect, it } from "vitest";

import { buildToc, flattenToc } from "@/lib/content/toc";
import type { DocHeading } from "@/lib/content/types";

function heading(id: string, level: DocHeading["level"]): DocHeading {
  return { id, text: id, level };
}

describe("buildToc", () => {
  it("nests a flat list into a tree", () => {
    const headings: DocHeading[] = [heading("a", 2), heading("b", 3), heading("c", 2)];
    const toc = buildToc(headings);

    expect(toc).toHaveLength(2);
    expect(toc[0]?.id).toBe("a");
    expect(toc[0]?.children).toHaveLength(1);
    expect(toc[0]?.children[0]?.id).toBe("b");
    expect(toc[1]?.id).toBe("c");
    expect(toc[1]?.children).toHaveLength(0);
  });

  it("attaches a skipped level to the nearest shallower ancestor", () => {
    const headings: DocHeading[] = [heading("a", 2), heading("b", 4)];
    const toc = buildToc(headings);

    expect(toc).toHaveLength(1);
    expect(toc[0]?.id).toBe("a");
    expect(toc[0]?.children).toHaveLength(1);
    expect(toc[0]?.children[0]?.id).toBe("b");
  });

  it("returns an empty array for empty input", () => {
    expect(buildToc([])).toEqual([]);
  });

  it("does not orphan headings when the first heading is deeper than later ones", () => {
    const headings: DocHeading[] = [heading("a", 4), heading("b", 2), heading("c", 3)];
    const toc = buildToc(headings);

    expect(toc.map((node) => node.id)).toEqual(["a", "b"]);
    expect(toc[0]?.children).toHaveLength(0);
    expect(toc[1]?.children.map((node) => node.id)).toEqual(["c"]);
  });
});

describe("flattenToc", () => {
  it("inverts buildToc back to document order", () => {
    const headings: DocHeading[] = [heading("a", 2), heading("b", 3), heading("c", 2)];
    expect(flattenToc(buildToc(headings))).toEqual(headings);
  });
});
