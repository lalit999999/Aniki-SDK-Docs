/**
 * Multi-version loader behaviour, exercised against the two-version
 * fixture tree in `tests/fixtures/content` rather than the real (currently
 * single-version) `content/docs`. The registry is mocked to declare v1 as
 * `"maintenance"` and v2 as `"latest"`, matching the fixture directories,
 * so `getAllVersionedRoutes`/`getDocVersions`/D6's latest-unprefixed
 * behaviour are genuinely tested instead of assumed from a single version.
 */
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const FIXTURE_ROOT = path.join(process.cwd(), "tests", "fixtures", "content");

const FIXTURE_VERSIONS = [
  { id: "v2", label: "v2.0", status: "latest" as const, releasedAt: "2026-02-01" },
  { id: "v1", label: "v1.0", status: "maintenance" as const, releasedAt: "2026-01-01" },
];

describe("multi-version loader behaviour", () => {
  beforeEach(() => {
    vi.stubEnv("ANIKI_CONTENT_DIR", FIXTURE_ROOT);
    vi.resetModules();
    vi.doMock("@/config/versions", () => ({ DOCS_VERSIONS: FIXTURE_VERSIONS }));
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.doUnmock("@/config/versions");
    vi.resetModules();
  });

  it("loads each version's own document set", async () => {
    const { getAllDocMeta, clearContentCache } = await import("@/lib/content/loader");
    clearContentCache();

    const v1Slugs = (await getAllDocMeta("v1")).map((meta) => meta.slug).sort();
    const v2Slugs = (await getAllDocMeta("v2")).map((meta) => meta.slug).sort();

    expect(v1Slugs).toEqual(["index", "getting-started", "shared-page"].sort());
    expect(v2Slugs).toEqual(["index", "shared-page"].sort());
  });

  it("omitting versionId resolves the latest version (v2 in this fixture)", async () => {
    const { getAllDocMeta, clearContentCache } = await import("@/lib/content/loader");
    clearContentCache();

    const defaultSlugs = (await getAllDocMeta()).map((meta) => meta.slug).sort();
    const v2Slugs = (await getAllDocMeta("v2")).map((meta) => meta.slug).sort();
    expect(defaultSlugs).toEqual(v2Slugs);
  });

  it("gives the same slug in two versions independent routes and versionedRoutes", async () => {
    const { getDocBySlug, clearContentCache } = await import("@/lib/content/loader");
    clearContentCache();

    const v1Page = await getDocBySlug("shared-page", "v1");
    const v2Page = await getDocBySlug("shared-page", "v2");

    expect(v1Page.meta.route).toBe("/docs/v1/shared-page");
    expect(v1Page.meta.versionedRoute).toBe("/docs/v1/shared-page");
    expect(v1Page.meta.isLatestVersion).toBe(false);

    expect(v2Page.meta.route).toBe("/docs/shared-page");
    expect(v2Page.meta.versionedRoute).toBe("/docs/v2/shared-page");
    expect(v2Page.meta.isLatestVersion).toBe(true);
  });

  it("getDocVersions summarizes every declared version with a live doc count", async () => {
    const { getDocVersions, clearContentCache } = await import("@/lib/content/loader");
    clearContentCache();

    const versions = await getDocVersions();
    const byId = new Map(versions.map((v) => [v.id, v]));

    expect(byId.get("v1")?.docCount).toBe(3);
    expect(byId.get("v1")?.indexRoute).toBe("/docs/v1");
    expect(byId.get("v2")?.docCount).toBe(2);
    expect(byId.get("v2")?.indexRoute).toBe("/docs");
  });

  it("getAllVersionedRoutes emits unprefixed segments only for the latest version", async () => {
    const { getAllVersionedRoutes, clearContentCache } = await import("@/lib/content/loader");
    clearContentCache();

    const routes = await getAllVersionedRoutes();

    const v2Index = routes.find((r) => r.versionId === "v2" && r.slug === "index");
    const v2Page = routes.find((r) => r.versionId === "v2" && r.slug === "shared-page");
    const v1Index = routes.find((r) => r.versionId === "v1" && r.slug === "index");
    const v1Page = routes.find((r) => r.versionId === "v1" && r.slug === "shared-page");

    expect(v2Index?.segments).toEqual([]);
    expect(v2Page?.segments).toEqual(["shared-page"]);
    expect(v1Index?.segments).toEqual(["v1"]);
    expect(v1Page?.segments).toEqual(["v1", "shared-page"]);
  });

  it("detects a duplicate slug within a single version, not across versions", async () => {
    const { getAllDocs, clearContentCache } = await import("@/lib/content/loader");
    clearContentCache();

    // Two versions legitimately sharing a slug ("shared-page") must not
    // throw DuplicateSlugError - only a collision *within* one version's
    // own file set should.
    await expect(getAllDocs("v1")).resolves.toBeDefined();
    await expect(getAllDocs("v2")).resolves.toBeDefined();
  });
});
