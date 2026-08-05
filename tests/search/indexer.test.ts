import { describe, expect, it } from "vitest";

import { getAllDocs } from "@/lib/content";
import { buildSearchIndex, SECTION_CONTENT_LIMIT } from "@/lib/search/indexer";

describe("buildSearchIndex (integration, real content/docs)", () => {
  it("indexes more than a handful of sections across the real document set", async () => {
    const index = await buildSearchIndex();
    expect(index.sections.length).toBeGreaterThan(20);
  });

  it("gives every section a globally unique id", async () => {
    const index = await buildSearchIndex();
    const ids = index.sections.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("resolves every section's headingId to an id present in its document's headings", async () => {
    const [index, docs] = await Promise.all([buildSearchIndex(), getAllDocs()]);
    const headingIdsBySlug = new Map(docs.map((doc) => [doc.meta.slug, new Set(doc.headings.map((h) => h.id))]));

    for (const section of index.sections) {
      if (section.headingId === null) {
        continue;
      }
      const headingIds = headingIdsBySlug.get(section.docSlug);
      expect(headingIds?.has(section.headingId)).toBe(true);
      expect(section.href).toBe(`${section.route}#${section.headingId}`);
    }
  });

  it("gives a lead section (no heading) an href equal to its bare route", async () => {
    const index = await buildSearchIndex();
    const leadSections = index.sections.filter((s) => s.headingId === null);
    expect(leadSections.length).toBeGreaterThan(0);
    for (const section of leadSections) {
      expect(section.href).toBe(section.route);
    }
  });

  it("never exceeds the section content cap", async () => {
    const index = await buildSearchIndex();
    for (const section of index.sections) {
      expect(section.content.length).toBeLessThanOrEqual(SECTION_CONTENT_LIMIT);
    }
  });

  it("excludes fenced code content - installation.md's install command is not indexed verbatim", async () => {
    const index = await buildSearchIndex();
    const installationSections = index.sections.filter((s) => s.docSlug === "installation");
    expect(installationSections.length).toBeGreaterThan(0);
    for (const section of installationSections) {
      expect(section.content).not.toContain("npm install aniki-sdk");
    }
  });

  it("stays well under the 512 KB payload budget", async () => {
    const index = await buildSearchIndex();
    const bytes = Buffer.byteLength(JSON.stringify(index), "utf-8");
    expect(bytes).toBeLessThan(512 * 1024);
  });
});
