import { describe, expect, it } from "vitest";

import { findAdjacentByRoute, flattenNav } from "@/lib/navigation/adjacent";
import type { DocCategory, DocMeta, DocNavCategory } from "@/lib/content/types";

function doc(slug: string, category: DocCategory, order: number): DocMeta {
  return {
    slug,
    route: slug === "index" ? "/docs" : `/docs/${slug}`,
    filePath: `content/docs/${slug}.md`,
    title: slug,
    description: slug,
    category,
    order,
    tags: [],
    draft: false,
    updatedAt: null,
    updatedSource: "unknown",
    readingTime: { minutes: 1, words: 1, text: "1 min read" },
  };
}

const nav: DocNavCategory[] = [
  {
    category: "Getting Started",
    docs: [doc("index", "Getting Started", 0), doc("installation", "Getting Started", 1)],
  },
  {
    category: "Core Concepts",
    docs: [doc("tools", "Core Concepts", 0), doc("memory", "Core Concepts", 1)],
  },
  {
    category: "Reference",
    docs: [doc("contributing", "Reference", 0)],
  },
];

describe("flattenNav", () => {
  it("flattens category order and each category's own order", () => {
    expect(flattenNav(nav).map((meta) => meta.slug)).toEqual([
      "index",
      "installation",
      "tools",
      "memory",
      "contributing",
    ]);
  });
});

describe("findAdjacentByRoute", () => {
  it("returns null previous for the first document", () => {
    const { previous, next } = findAdjacentByRoute(nav, "/docs");
    expect(previous).toBeNull();
    expect(next?.slug).toBe("installation");
  });

  it("returns null next for the last document", () => {
    const { previous, next } = findAdjacentByRoute(nav, "/docs/contributing");
    expect(next).toBeNull();
    expect(previous?.slug).toBe("memory");
  });

  it("crosses category boundaries", () => {
    const { next } = findAdjacentByRoute(nav, "/docs/installation");
    expect(next?.slug).toBe("tools");
  });

  it("returns both null for a pathname with no matching document", () => {
    expect(findAdjacentByRoute(nav, "/")).toEqual({ previous: null, next: null });
  });
});
