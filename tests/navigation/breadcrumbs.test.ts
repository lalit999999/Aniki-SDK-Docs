import { describe, expect, it } from "vitest";

import { buildBreadcrumbJsonLd, buildBreadcrumbTrail, categoryAnchorId } from "@/lib/navigation/breadcrumbs";

describe("categoryAnchorId", () => {
  it("slugifies every doc category", () => {
    expect(categoryAnchorId("Getting Started")).toBe("getting-started");
    expect(categoryAnchorId("Core Concepts")).toBe("core-concepts");
    expect(categoryAnchorId("Reference")).toBe("reference");
  });
});

describe("buildBreadcrumbTrail", () => {
  it("returns a single segment for the docs index", () => {
    const trail = buildBreadcrumbTrail(null);
    expect(trail).toEqual([{ label: "Docs", href: null }]);
  });

  it("builds a three-segment trail for a Getting Started doc", () => {
    const trail = buildBreadcrumbTrail({ title: "Installation", category: "Getting Started" });
    expect(trail).toEqual([
      { label: "Docs", href: "/docs" },
      { label: "Getting Started", href: "/docs#getting-started" },
      { label: "Installation", href: null },
    ]);
  });

  it("builds a three-segment trail for a Reference doc", () => {
    const trail = buildBreadcrumbTrail({ title: "API Reference", category: "Reference" });
    expect(trail).toEqual([
      { label: "Docs", href: "/docs" },
      { label: "Reference", href: "/docs#reference" },
      { label: "API Reference", href: null },
    ]);
  });
});

describe("buildBreadcrumbJsonLd", () => {
  it("assigns sequential, 1-based positions", () => {
    const trail = buildBreadcrumbTrail({ title: "Tools", category: "Core Concepts" });
    const jsonLd = JSON.parse(buildBreadcrumbJsonLd(trail, "https://docs.example.com"));

    expect(jsonLd["@type"]).toBe("BreadcrumbList");
    expect(jsonLd.itemListElement.map((item: { position: number }) => item.position)).toEqual([1, 2, 3]);
  });

  it("resolves absolute URLs from the site origin for linked segments", () => {
    const trail = buildBreadcrumbTrail({ title: "Tools", category: "Core Concepts" });
    const jsonLd = JSON.parse(buildBreadcrumbJsonLd(trail, "https://docs.example.com"));

    expect(jsonLd.itemListElement[0].item).toBe("https://docs.example.com/docs");
    expect(jsonLd.itemListElement[1].item).toBe("https://docs.example.com/docs#core-concepts");
  });

  it("omits an item URL for the current page", () => {
    const trail = buildBreadcrumbTrail({ title: "Tools", category: "Core Concepts" });
    const jsonLd = JSON.parse(buildBreadcrumbJsonLd(trail, "https://docs.example.com"));

    expect(jsonLd.itemListElement[2].item).toBeUndefined();
    expect(jsonLd.itemListElement[2].name).toBe("Tools");
  });
});
