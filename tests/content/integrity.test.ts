/**
 * Integration test against the real 16 files in content/docs - the actual
 * proof that the content loader works, not just that its pieces do in
 * isolation. Every expectation here is measured from the current content
 * set (see the sub-task 10 spec); if one fails, treat the loader as wrong
 * before treating the expectation as wrong.
 */
import { beforeEach, describe, expect, it } from "vitest";

import { ContentNotFoundError } from "@/lib/content/errors";
import {
  clearContentCache,
  getAdjacentDocs,
  getAllDocs,
  getDocBySlug,
  getDocNavigation,
} from "@/lib/content/loader";

beforeEach(() => {
  clearContentCache();
});

describe("content integrity", () => {
  it("loads exactly 16 documents", async () => {
    const docs = await getAllDocs();
    expect(docs).toHaveLength(16);
  });

  it("gives every document a non-empty title and description", async () => {
    const docs = await getAllDocs();
    for (const doc of docs) {
      expect(doc.meta.title.length).toBeGreaterThan(0);
      expect(doc.meta.description.length).toBeGreaterThan(0);
    }
  });

  it("gives every document a unique slug", async () => {
    const docs = await getAllDocs();
    const slugs = docs.map((doc) => doc.meta.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("resolves README.md to slug \"index\" and route \"/docs\"", async () => {
    const doc = await getDocBySlug("index");
    expect(doc.meta.slug).toBe("index");
    expect(doc.meta.route).toBe("/docs");
  });

  it("excludes pnpm/yarn/bun from installation.md's headings", async () => {
    const doc = await getDocBySlug("installation");
    const ids = doc.headings.map((heading) => heading.id);
    expect(ids).not.toContain("pnpm");
    expect(ids).not.toContain("yarn");
    expect(ids).not.toContain("bun");
  });

  it("produces heading ids goal through goal-8 in guides.md", async () => {
    const doc = await getDocBySlug("guides");
    const ids = doc.headings.map((heading) => heading.id);
    const expected = ["goal", ...Array.from({ length: 8 }, (_, i) => `goal-${i + 1}`)];
    for (const id of expected) {
      expect(ids).toContain(id);
    }
  });

  it("produces both overview and overview-1 in providers.md", async () => {
    const doc = await getDocBySlug("providers");
    const ids = doc.headings.map((heading) => heading.id);
    expect(ids).toContain("overview");
    expect(ids).toContain("overview-1");
  });

  it("never starts a document's content with an H1", async () => {
    const docs = await getAllDocs();
    for (const doc of docs) {
      expect(doc.content.trimStart()).not.toMatch(/^# /);
    }
  });

  it("always starts a document's rawContent with an H1", async () => {
    const docs = await getAllDocs();
    for (const doc of docs) {
      expect(doc.rawContent.trimStart().startsWith("# ")).toBe(true);
    }
  });

  it("estimates api-reference.md reading time under 30 minutes with code excluded", async () => {
    const doc = await getDocBySlug("api-reference");
    expect(doc.meta.readingTime.minutes).toBeLessThan(30);
  });

  it("gives every document a resolved updatedAt and updatedSource", async () => {
    const docs = await getAllDocs();
    for (const doc of docs) {
      expect(doc.meta.updatedAt).not.toBeNull();
      expect(["frontmatter", "git", "filesystem", "unknown"]).toContain(doc.meta.updatedSource);
    }
  });

  it("has no previous document before the index page", async () => {
    const { previous } = await getAdjacentDocs("index");
    expect(previous).toBeNull();
  });

  it("has no next document after contributing", async () => {
    const { next } = await getAdjacentDocs("contributing");
    expect(next).toBeNull();
  });

  it("orders navigation Getting Started -> Core Concepts -> Reference", async () => {
    const nav = await getDocNavigation();
    expect(nav.map((group) => group.category)).toEqual([
      "Getting Started",
      "Core Concepts",
      "Reference",
    ]);
    for (const group of nav) {
      expect(group.docs.length).toBeGreaterThan(0);
    }
  });

  it("rejects an unknown slug with ContentNotFoundError", async () => {
    await expect(getDocBySlug("does-not-exist")).rejects.toBeInstanceOf(ContentNotFoundError);
  });
});
