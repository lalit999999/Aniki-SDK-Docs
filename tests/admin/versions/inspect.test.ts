/**
 * Exercises `detectDrift`, `inspectVersions`, and `validateNewVersionInput`
 * against a dedicated three-directory fixture tree
 * (`tests/admin/versions/fixtures/content`: v1, v2, v3 always present on
 * disk) with the declared registry varied per test - the same technique
 * `tests/content/versions.test.ts` and `tests/seo/sitemap.test.ts` use to
 * exercise multi-version behaviour without touching the real
 * (currently single-version) `content/docs`.
 */
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const FIXTURE_ROOT = path.join(process.cwd(), "tests", "admin", "versions", "fixtures", "content");

const CLEAN_VERSIONS = [
  { id: "v2", label: "v2.0", status: "latest" as const, releasedAt: "2026-02-01" },
  { id: "v1", label: "v1.0", status: "maintenance" as const, releasedAt: "2026-01-01" },
  { id: "v3", label: "v3.0", status: "maintenance" as const, releasedAt: "2025-12-01" },
];

const UNDECLARED_DIRECTORY_VERSIONS = [
  { id: "v2", label: "v2.0", status: "latest" as const, releasedAt: "2026-02-01" },
  { id: "v1", label: "v1.0", status: "maintenance" as const, releasedAt: "2026-01-01" },
];

const MISSING_DIRECTORY_VERSIONS = [
  { id: "v2", label: "v2.0", status: "latest" as const, releasedAt: "2026-02-01" },
  { id: "v1", label: "v1.0", status: "maintenance" as const, releasedAt: "2026-01-01" },
  { id: "v3", label: "v3.0", status: "maintenance" as const, releasedAt: "2025-12-01" },
  { id: "v9", label: "v9.0", status: "maintenance" as const, releasedAt: "2025-11-01" },
];

const MIGRATION_GUIDE_VERSIONS = [
  {
    id: "v2",
    label: "v2.0",
    status: "latest" as const,
    releasedAt: "2026-02-01",
    migrationGuideSlug: "migration-guide",
  },
  { id: "v1", label: "v1.0", status: "maintenance" as const, releasedAt: "2026-01-01" },
];

const DANGLING_MIGRATION_GUIDE_VERSIONS = [
  {
    id: "v2",
    label: "v2.0",
    status: "latest" as const,
    releasedAt: "2026-02-01",
    migrationGuideSlug: "does-not-exist",
  },
  { id: "v1", label: "v1.0", status: "maintenance" as const, releasedAt: "2026-01-01" },
];

function mockRegistry(versions: unknown): void {
  vi.doMock("@/config/versions", () => ({ DOCS_VERSIONS: versions }));
}

beforeEach(() => {
  vi.stubEnv("ANIKI_CONTENT_DIR", FIXTURE_ROOT);
  vi.resetModules();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.doUnmock("@/config/versions");
  vi.resetModules();
});

describe("detectDrift", () => {
  it("reports no drift when the registry and disk agree exactly", async () => {
    mockRegistry(CLEAN_VERSIONS);
    const { detectDrift, hasDrift } = await import("@/lib/admin/versions/inspect");

    const report = await detectDrift();
    expect(report.declaredWithoutDirectory).toEqual([]);
    expect(report.directoryWithoutDeclaration).toEqual([]);
    expect(hasDrift(report)).toBe(false);
  });

  it("reports a directory with no matching declared version", async () => {
    mockRegistry(UNDECLARED_DIRECTORY_VERSIONS);
    const { detectDrift, hasDrift } = await import("@/lib/admin/versions/inspect");

    const report = await detectDrift();
    expect(report.directoryWithoutDeclaration).toEqual(["v3"]);
    expect(report.declaredWithoutDirectory).toEqual([]);
    expect(hasDrift(report)).toBe(true);
  });

  it("reports a declared version with no directory", async () => {
    mockRegistry(MISSING_DIRECTORY_VERSIONS);
    const { detectDrift, hasDrift } = await import("@/lib/admin/versions/inspect");

    const report = await detectDrift();
    expect(report.declaredWithoutDirectory).toEqual(["v9"]);
    expect(report.directoryWithoutDeclaration).toEqual([]);
    expect(hasDrift(report)).toBe(true);
  });
});

describe("inspectVersions", () => {
  it("counts docs, drafts, and deprecated pages per version", async () => {
    mockRegistry(CLEAN_VERSIONS);
    const { inspectVersions } = await import("@/lib/admin/versions/inspect");

    const { versions } = await inspectVersions();
    const v2 = versions.find((version) => version.id === "v2");

    expect(v2?.docCount).toBe(4);
    expect(v2?.draftCount).toBe(1);
    expect(v2?.deprecatedCount).toBe(1);
    expect(v2?.directoryExists).toBe(true);
  });

  it("never throws for a declared version with no directory, and zeroes its counts", async () => {
    mockRegistry(MISSING_DIRECTORY_VERSIONS);
    const { inspectVersions } = await import("@/lib/admin/versions/inspect");

    const { versions, drift } = await inspectVersions();
    const v9 = versions.find((version) => version.id === "v9");

    expect(v9?.directoryExists).toBe(false);
    expect(v9?.docCount).toBe(0);
    expect(v9?.draftCount).toBe(0);
    expect(v9?.deprecatedCount).toBe(0);
    expect(drift.declaredWithoutDirectory).toEqual(["v9"]);
  });

  it("resolves indexRoute and prefixedUrlRedirects per T4", async () => {
    mockRegistry(CLEAN_VERSIONS);
    const { inspectVersions } = await import("@/lib/admin/versions/inspect");

    const { versions } = await inspectVersions();
    const latest = versions.find((version) => version.id === "v2");
    const maintenance = versions.find((version) => version.id === "v1");

    expect(latest?.indexRoute).toBe("/docs");
    expect(latest?.prefixedUrlRedirects).toBe(true);
    expect(maintenance?.indexRoute).toBe("/docs/v1");
    expect(maintenance?.prefixedUrlRedirects).toBe(false);
  });

  it("resolves migrationGuideSlug when it points to a real page", async () => {
    mockRegistry(MIGRATION_GUIDE_VERSIONS);
    const { inspectVersions } = await import("@/lib/admin/versions/inspect");

    const { versions } = await inspectVersions();
    const v2 = versions.find((version) => version.id === "v2");
    const v1 = versions.find((version) => version.id === "v1");

    expect(v2?.migrationGuideResolves).toBe(true);
    expect(v1?.migrationGuideResolves).toBeNull();
  });

  it("reports migrationGuideSlug as unresolved when it names no real page", async () => {
    mockRegistry(DANGLING_MIGRATION_GUIDE_VERSIONS);
    const { inspectVersions } = await import("@/lib/admin/versions/inspect");

    const { versions } = await inspectVersions();
    const v2 = versions.find((version) => version.id === "v2");

    expect(v2?.migrationGuideResolves).toBe(false);
  });
});

describe("validateNewVersionInput", () => {
  it("passes a fully valid input with no issues", async () => {
    mockRegistry(CLEAN_VERSIONS);
    const { validateNewVersionInput } = await import("@/lib/admin/versions/inspect");

    const issues = await validateNewVersionInput({
      id: "v4",
      label: "v4.0",
      releasedAt: "2026-03-01",
      sourceVersionId: "v2",
      promoteToLatest: true,
    });
    expect(issues).toEqual([]);
  });

  it("flags an id that doesn't match VERSION_ID_PATTERN", async () => {
    mockRegistry(CLEAN_VERSIONS);
    const { validateNewVersionInput } = await import("@/lib/admin/versions/inspect");

    const issues = await validateNewVersionInput({
      id: "next",
      label: "Next",
      releasedAt: "2026-03-01",
      sourceVersionId: "v2",
      promoteToLatest: false,
    });
    expect(issues.some((issue) => issue.includes("not a valid version id"))).toBe(true);
  });

  it("flags a duplicate id", async () => {
    mockRegistry(CLEAN_VERSIONS);
    const { validateNewVersionInput } = await import("@/lib/admin/versions/inspect");

    const issues = await validateNewVersionInput({
      id: "v2",
      label: "v2 again",
      releasedAt: "2026-03-01",
      sourceVersionId: "v1",
      promoteToLatest: false,
    });
    expect(issues.some((issue) => issue.includes("already exists"))).toBe(true);
  });

  it("flags an empty label", async () => {
    mockRegistry(CLEAN_VERSIONS);
    const { validateNewVersionInput } = await import("@/lib/admin/versions/inspect");

    const issues = await validateNewVersionInput({
      id: "v4",
      label: "   ",
      releasedAt: "2026-03-01",
      sourceVersionId: "v2",
      promoteToLatest: false,
    });
    expect(issues.some((issue) => issue.includes("label"))).toBe(true);
  });

  it("flags a releasedAt that isn't YYYY-MM-DD", async () => {
    mockRegistry(CLEAN_VERSIONS);
    const { validateNewVersionInput } = await import("@/lib/admin/versions/inspect");

    const issues = await validateNewVersionInput({
      id: "v4",
      label: "v4.0",
      releasedAt: "03/01/2026",
      sourceVersionId: "v2",
      promoteToLatest: false,
    });
    expect(issues.some((issue) => issue.includes("YYYY-MM-DD"))).toBe(true);
  });

  it("flags a releasedAt not newer than the current newest version", async () => {
    mockRegistry(CLEAN_VERSIONS);
    const { validateNewVersionInput } = await import("@/lib/admin/versions/inspect");

    const issues = await validateNewVersionInput({
      id: "v4",
      label: "v4.0",
      releasedAt: "2026-01-15",
      sourceVersionId: "v2",
      promoteToLatest: false,
    });
    expect(issues.some((issue) => issue.includes("must be newer than"))).toBe(true);
  });

  it("flags an unknown source version", async () => {
    mockRegistry(CLEAN_VERSIONS);
    const { validateNewVersionInput } = await import("@/lib/admin/versions/inspect");

    const issues = await validateNewVersionInput({
      id: "v4",
      label: "v4.0",
      releasedAt: "2026-03-01",
      sourceVersionId: "v99",
      promoteToLatest: false,
    });
    expect(issues.some((issue) => issue.includes("unknown source version"))).toBe(true);
  });

  it("flags a migrationGuideSlug that won't resolve in the source version", async () => {
    mockRegistry(CLEAN_VERSIONS);
    const { validateNewVersionInput } = await import("@/lib/admin/versions/inspect");

    const issues = await validateNewVersionInput({
      id: "v4",
      label: "v4.0",
      releasedAt: "2026-03-01",
      sourceVersionId: "v2",
      promoteToLatest: false,
      migrationGuideSlug: "no-such-page",
    });
    expect(issues.some((issue) => issue.includes("migrationGuideSlug"))).toBe(true);
  });

  it("accepts a migrationGuideSlug that resolves in the source version", async () => {
    mockRegistry(CLEAN_VERSIONS);
    const { validateNewVersionInput } = await import("@/lib/admin/versions/inspect");

    const issues = await validateNewVersionInput({
      id: "v4",
      label: "v4.0",
      releasedAt: "2026-03-01",
      sourceVersionId: "v2",
      promoteToLatest: false,
      migrationGuideSlug: "migration-guide",
    });
    expect(issues.some((issue) => issue.includes("migrationGuideSlug"))).toBe(false);
  });

  it("aggregates every issue at once rather than stopping at the first", async () => {
    mockRegistry(CLEAN_VERSIONS);
    const { validateNewVersionInput } = await import("@/lib/admin/versions/inspect");

    const issues = await validateNewVersionInput({
      id: "not-a-version",
      label: "",
      releasedAt: "not-a-date",
      sourceVersionId: "v99",
      promoteToLatest: false,
    });
    expect(issues.length).toBeGreaterThanOrEqual(4);
  });
});
