import { describe, expect, it } from "vitest";

import { seoConfig } from "@/config/seo";
import { siteConfig } from "@/config/site";
import { InvalidSeoInputError } from "@/lib/seo/errors";
import {
  buildAbsoluteUrl,
  buildArticleJsonLd,
  buildBreadcrumbJsonLd,
  buildPageMetadata,
  validateSeoFields,
} from "@/lib/seo/metadata";

describe("buildAbsoluteUrl", () => {
  it("returns an absolute URL with no trailing slash", () => {
    const url = buildAbsoluteUrl("/docs/tools");
    expect(url).toBe(`${siteConfig.url}/docs/tools`);
    expect(url.endsWith("/")).toBe(false);
  });

  it("normalizes a leading-slash-free path", () => {
    expect(buildAbsoluteUrl("docs/tools")).toBe(buildAbsoluteUrl("/docs/tools"));
  });

  it("strips a trailing slash from the input path", () => {
    expect(buildAbsoluteUrl("/docs/tools/")).toBe(buildAbsoluteUrl("/docs/tools"));
  });

  it("resolves the root path to the bare origin", () => {
    expect(buildAbsoluteUrl("/")).toBe(siteConfig.url.replace(/\/+$/, ""));
  });

  it("throws InvalidSeoInputError for an empty path", () => {
    expect(() => buildAbsoluteUrl("")).toThrow(InvalidSeoInputError);
    expect(() => buildAbsoluteUrl("   ")).toThrow(InvalidSeoInputError);
  });
});

describe("buildPageMetadata", () => {
  it("sets an absolute canonical URL", () => {
    const metadata = buildPageMetadata({
      title: "Tools",
      description: "How to define tools for an agent.",
      path: "/docs/tools",
      type: "article",
    });
    expect(metadata.alternates?.canonical).toBe(`${siteConfig.url}/docs/tools`);
  });

  it("produces noindex robots directives when noindex is true", () => {
    const metadata = buildPageMetadata({
      title: "Legacy page",
      description: "An old version of this page.",
      path: "/docs/v1/tools",
      type: "article",
      noindex: true,
    });
    expect(metadata.robots).toEqual({ index: false, follow: true });
  });

  it("omits robots when noindex is false or unset", () => {
    const metadata = buildPageMetadata({
      title: "Tools",
      description: "How to define tools for an agent.",
      path: "/docs/tools",
      type: "article",
    });
    expect(metadata.robots).toBeUndefined();
  });

  it("resolves a site-relative imageUrl to an absolute OG image URL", () => {
    const metadata = buildPageMetadata({
      title: "Tools",
      description: "How to define tools for an agent.",
      path: "/docs/tools",
      type: "article",
      imageUrl: "/docs/tools/opengraph-image",
    });
    const openGraph = metadata.openGraph as { images?: { url: string }[] };
    expect(openGraph.images?.[0]?.url).toBe(`${siteConfig.url}/docs/tools/opengraph-image`);
  });

  it("leaves an already-absolute imageUrl untouched", () => {
    const absolute = "https://cdn.example.com/custom-og.png";
    const metadata = buildPageMetadata({
      title: "Tools",
      description: "How to define tools for an agent.",
      path: "/docs/tools",
      type: "article",
      imageUrl: absolute,
    });
    const openGraph = metadata.openGraph as { images?: { url: string }[] };
    expect(openGraph.images?.[0]?.url).toBe(absolute);
  });

  it("passes keywords through when non-empty", () => {
    const metadata = buildPageMetadata({
      title: "Tools",
      description: "How to define tools for an agent.",
      path: "/docs/tools",
      type: "article",
      keywords: ["tools", "agents"],
    });
    expect(metadata.keywords).toEqual(["tools", "agents"]);
  });
});

describe("buildBreadcrumbJsonLd", () => {
  it("matches schema.org BreadcrumbList field names", () => {
    const jsonLd = buildBreadcrumbJsonLd([
      { label: "Docs", path: "/docs" },
      { label: "Tools", path: "/docs/tools" },
    ]);
    expect(jsonLd["@context"]).toBe("https://schema.org");
    expect(jsonLd["@type"]).toBe("BreadcrumbList");
    expect(jsonLd.itemListElement).toEqual([
      { "@type": "ListItem", position: 1, name: "Docs", item: `${siteConfig.url}/docs` },
      { "@type": "ListItem", position: 2, name: "Tools", item: `${siteConfig.url}/docs/tools` },
    ]);
  });
});

describe("buildArticleJsonLd", () => {
  it("matches schema.org Article field names", () => {
    const jsonLd = buildArticleJsonLd({
      title: "Tools",
      description: "How to define tools for an agent.",
      path: "/docs/tools",
      modifiedAt: "2026-08-03T00:00:00.000Z",
    });
    expect(jsonLd["@type"]).toBe("Article");
    expect(jsonLd.headline).toBe("Tools");
    expect(jsonLd.description).toBe("How to define tools for an agent.");
    expect(jsonLd.url).toBe(`${siteConfig.url}/docs/tools`);
    expect(jsonLd.dateModified).toBe("2026-08-03T00:00:00.000Z");
    expect(jsonLd.publisher).toMatchObject({
      "@type": "Organization",
      name: seoConfig.organization.name,
      url: seoConfig.organization.url,
    });
  });
});

describe("validateSeoFields", () => {
  it("warns on an empty description", () => {
    expect(validateSeoFields({ title: "Tools", description: "" })).toContain("description is empty");
  });

  it("warns on an over-length title", () => {
    const longTitle = "T".repeat(seoConfig.titleMaxLength + 1);
    const warnings = validateSeoFields({ title: longTitle, description: "A short description." });
    expect(warnings.some((warning) => warning.includes("title exceeds"))).toBe(true);
  });

  it("warns on an over-length description", () => {
    const longDescription = "D".repeat(seoConfig.descriptionMaxLength + 1);
    const warnings = validateSeoFields({ title: "Tools", description: longDescription });
    expect(warnings.some((warning) => warning.includes("description exceeds"))).toBe(true);
  });

  it("warns when description equals title", () => {
    const warnings = validateSeoFields({ title: "Tools", description: "Tools" });
    expect(warnings).toContain("description is identical to title");
  });

  it("warns on markdown syntax in title or description", () => {
    const warnings = validateSeoFields({ title: "`Tools`", description: "A **great** feature." });
    expect(warnings).toContain("title contains markdown syntax");
    expect(warnings).toContain("description contains markdown syntax");
  });

  it("returns no warnings for a clean, well-sized pair", () => {
    expect(validateSeoFields({ title: "Tools", description: "How to define tools for an agent." })).toEqual([]);
  });
});
