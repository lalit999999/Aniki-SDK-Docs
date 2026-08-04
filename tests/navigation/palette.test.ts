import { describe, expect, it } from "vitest";

import { buildPaletteItems } from "@/lib/navigation/palette";
import type { DocCategory, DocMeta, DocNavCategory } from "@/lib/content/types";
import type { SiteNavLink } from "@/config/site";

function doc(slug: string, category: DocCategory, order: number): DocMeta {
  return {
    slug,
    route: slug === "index" ? "/docs" : `/docs/${slug}`,
    filePath: `content/docs/${slug}.md`,
    title: slug,
    description: `${slug} description`,
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
  { category: "Core Concepts", docs: [doc("tools", "Core Concepts", 0)] },
  { category: "Reference", docs: [doc("contributing", "Reference", 0)] },
];

const primaryNav: SiteNavLink[] = [{ label: "Changelog", href: "/changelog" }];

describe("buildPaletteItems", () => {
  it("counts every document plus every primary nav link", () => {
    const items = buildPaletteItems(nav, primaryNav);
    expect(items).toHaveLength(5);
  });

  it("groups documents by DOC_CATEGORIES order with Site last", () => {
    const items = buildPaletteItems(nav, primaryNav);
    const groupOrder = [...new Set(items.map((item) => item.group))];
    expect(groupOrder).toEqual(["Getting Started", "Core Concepts", "Reference", "Site"]);
  });

  it("includes the /docs overview exactly once", () => {
    const items = buildPaletteItems(nav, primaryNav);
    expect(items.filter((item) => item.route === "/docs")).toHaveLength(1);
  });

  it("gives every item a unique id", () => {
    const items = buildPaletteItems(nav, primaryNav);
    const ids = new Set(items.map((item) => item.id));
    expect(ids.size).toBe(items.length);
  });

  it("routes every document item to its own DocMeta route", () => {
    const items = buildPaletteItems(nav, primaryNav);
    const installation = items.find((item) => item.id === "doc:installation");
    expect(installation?.route).toBe("/docs/installation");
  });

  it("produces no Site group when primaryNav is empty", () => {
    const items = buildPaletteItems(nav, []);
    expect(items.some((item) => item.group === "Site")).toBe(false);
  });
});
