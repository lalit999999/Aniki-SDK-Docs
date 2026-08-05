import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("deprecation and migration frontmatter, index-build validation", () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(path.join(tmpdir(), "content-deprecation-test-"));
    await mkdir(path.join(dir, "v1"), { recursive: true });
    vi.stubEnv("ANIKI_CONTENT_DIR", dir);
    vi.resetModules();
  });

  afterEach(async () => {
    vi.unstubAllEnvs();
    vi.doUnmock("@/config/versions");
    vi.resetModules();
    await rm(dir, { recursive: true, force: true });
  });

  it("loads deprecated meta and resolves a valid replacedBy pointer", async () => {
    await writeFile(
      path.join(dir, "v1", "old-page.md"),
      [
        "---",
        "title: Old Page",
        "description: An old page.",
        "category: Reference",
        "order: 1",
        "deprecated: true",
        "deprecatedSince: 2026-01-01",
        "deprecatedReason: Superseded.",
        "replacedBy: new-page",
        "---",
        "",
        "# Old Page",
      ].join("\n"),
      "utf-8",
    );
    await writeFile(
      path.join(dir, "v1", "new-page.md"),
      ["---", "title: New Page", "description: The replacement.", "category: Reference", "order: 2", "---", "", "# New Page"].join(
        "\n",
      ),
      "utf-8",
    );

    const { getAllDocs, clearContentCache } = await import("@/lib/content/loader");
    clearContentCache();
    const docs = await getAllDocs("v1");
    const old = docs.find((doc) => doc.meta.slug === "old-page");
    expect(old?.meta.deprecated).toBe(true);
    expect(old?.meta.deprecatedSince).toBe("2026-01-01");
    expect(old?.meta.deprecatedReason).toBe("Superseded.");
    expect(old?.meta.replacedBy).toBe("new-page");
  });

  it("throws FrontmatterValidationError for a dangling replacedBy pointer", async () => {
    await writeFile(
      path.join(dir, "v1", "old-page.md"),
      [
        "---",
        "title: Old Page",
        "description: An old page.",
        "category: Reference",
        "order: 1",
        "deprecated: true",
        "replacedBy: does-not-exist",
        "---",
        "",
        "# Old Page",
      ].join("\n"),
      "utf-8",
    );

    const { getAllDocs, clearContentCache } = await import("@/lib/content/loader");
    const { FrontmatterValidationError } = await import("@/lib/content/errors");
    clearContentCache();
    await expect(getAllDocs("v1")).rejects.toBeInstanceOf(FrontmatterValidationError);
  });

  it("throws VersionConfigError when a version's migrationGuideSlug has no matching page", async () => {
    await writeFile(
      path.join(dir, "v1", "README.md"),
      ["---", "title: Home", "description: Home.", "category: Getting Started", "order: 0", "---", "", "# Home"].join("\n"),
      "utf-8",
    );

    vi.doMock("@/config/versions", () => ({
      DOCS_VERSIONS: [
        {
          id: "v1",
          label: "v1.0",
          status: "latest",
          releasedAt: "2026-01-01",
          migrationGuideSlug: "migrating-from-v0",
        },
      ],
    }));

    const { getDocVersions, clearContentCache } = await import("@/lib/content/loader");
    const { VersionConfigError } = await import("@/lib/versions/errors");
    clearContentCache();
    await expect(getDocVersions()).rejects.toBeInstanceOf(VersionConfigError);
  });

  it("resolves getDocVersions successfully when migrationGuideSlug points at a real page", async () => {
    await writeFile(
      path.join(dir, "v1", "README.md"),
      ["---", "title: Home", "description: Home.", "category: Getting Started", "order: 0", "---", "", "# Home"].join("\n"),
      "utf-8",
    );
    await writeFile(
      path.join(dir, "v1", "migrating-from-v0.md"),
      [
        "---",
        "title: Migrating from v0",
        "description: Migration guide.",
        "category: Reference",
        "order: 1",
        "---",
        "",
        "# Migrating from v0",
      ].join("\n"),
      "utf-8",
    );

    vi.doMock("@/config/versions", () => ({
      DOCS_VERSIONS: [
        {
          id: "v1",
          label: "v1.0",
          status: "latest",
          releasedAt: "2026-01-01",
          migrationGuideSlug: "migrating-from-v0",
        },
      ],
    }));

    const { getDocVersions, clearContentCache } = await import("@/lib/content/loader");
    clearContentCache();
    const versions = await getDocVersions();
    expect(versions[0]?.docCount).toBe(2);
  });
});
