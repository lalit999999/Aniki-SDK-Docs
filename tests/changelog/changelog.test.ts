import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { compareSemver } from "@/lib/changelog/semver";

describe("compareSemver", () => {
  it("compares major/minor/patch numerically, not lexicographically", () => {
    expect(compareSemver("1.10.0", "1.9.0")).toBeGreaterThan(0);
    expect(compareSemver("1.9.0", "1.10.0")).toBeLessThan(0);
  });

  it("returns 0 for equal versions", () => {
    expect(compareSemver("1.0.0", "1.0.0")).toBe(0);
  });

  it("compares major first, then minor, then patch", () => {
    expect(compareSemver("2.0.0", "1.9.9")).toBeGreaterThan(0);
    expect(compareSemver("1.2.0", "1.1.9")).toBeGreaterThan(0);
    expect(compareSemver("1.1.2", "1.1.1")).toBeGreaterThan(0);
  });
});

describe("changelog loader against the real content/changelog", () => {
  it("loads the real v1.0.0 release", async () => {
    const { getAllReleases, clearChangelogCache } = await import("@/lib/changelog/loader");
    clearChangelogCache();
    const releases = await getAllReleases();
    expect(releases.length).toBeGreaterThanOrEqual(1);
    const v1 = releases.find((release) => release.meta.slug === "v1.0.0");
    expect(v1).toBeDefined();
    expect(v1?.meta.docsVersion).toBe("v1");
    expect(v1?.meta.route).toBe("/changelog/v1.0.0");
    expect(v1?.headings.some((h) => h.text === "Features")).toBe(true);
  });

  it("rejects an unknown slug with ReleaseNotFoundError", async () => {
    const { getReleaseBySlug, clearChangelogCache } = await import("@/lib/changelog/loader");
    const { ReleaseNotFoundError } = await import("@/lib/changelog/errors");
    clearChangelogCache();
    await expect(getReleaseBySlug("v9.9.9")).rejects.toBeInstanceOf(ReleaseNotFoundError);
  });
});

describe("changelog loader against a fixture tree", () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(path.join(tmpdir(), "changelog-test-"));
    vi.stubEnv("ANIKI_CHANGELOG_DIR", dir);
    vi.resetModules();
  });

  afterEach(async () => {
    vi.unstubAllEnvs();
    vi.resetModules();
    await rm(dir, { recursive: true, force: true });
  });

  async function writeRelease(fileName: string, frontmatter: string, body = "## Features\n\nStuff.\n") {
    await writeFile(path.join(dir, fileName), `---\n${frontmatter}\n---\n\n${body}`, "utf-8");
  }

  it("sorts releases newest-first by date, tie-broken by descending semver", async () => {
    await writeRelease(
      "v1.0.0.md",
      'version: "1.0.0"\ntitle: "One"\ndate: 2026-01-01\ndocsVersion: "v1"\nstatus: "stable"\nsummary: "One."',
    );
    await writeRelease(
      "v1.1.0.md",
      'version: "1.1.0"\ntitle: "One point one"\ndate: 2026-01-01\ndocsVersion: "v1"\nstatus: "stable"\nsummary: "One one."',
    );
    await writeRelease(
      "v2.0.0.md",
      'version: "2.0.0"\ntitle: "Two"\ndate: 2026-03-01\ndocsVersion: "v1"\nstatus: "stable"\nsummary: "Two."',
    );

    const { getAllReleaseMeta, clearChangelogCache } = await import("@/lib/changelog/loader");
    clearChangelogCache();
    const metas = await getAllReleaseMeta();
    expect(metas.map((m) => m.slug)).toEqual(["v2.0.0", "v1.1.0", "v1.0.0"]);
  });

  it("rejects an unrecognized docsVersion", async () => {
    await writeRelease(
      "v1.0.0.md",
      'version: "1.0.0"\ntitle: "One"\ndate: 2026-01-01\ndocsVersion: "v999"\nstatus: "stable"\nsummary: "One."',
    );

    const { getAllReleases, clearChangelogCache } = await import("@/lib/changelog/loader");
    const { ReleaseFrontmatterInvalidError } = await import("@/lib/changelog/errors");
    clearChangelogCache();
    await expect(getAllReleases()).rejects.toBeInstanceOf(ReleaseFrontmatterInvalidError);
  });

  it("rejects invalid frontmatter, aggregating every issue", async () => {
    await writeRelease("v1.0.0.md", 'version: "not-a-semver"\ntitle: ""\ndate: "not-a-date"\ndocsVersion: "v1"\nstatus: "unknown"\nsummary: ""');

    const { getAllReleases, clearChangelogCache } = await import("@/lib/changelog/loader");
    const { ReleaseFrontmatterInvalidError } = await import("@/lib/changelog/errors");
    clearChangelogCache();
    try {
      await getAllReleases();
      expect.unreachable("expected getAllReleases to throw");
    } catch (error) {
      expect(error).toBeInstanceOf(ReleaseFrontmatterInvalidError);
      const issues = (error as InstanceType<typeof ReleaseFrontmatterInvalidError>).context.issues as string[];
      expect(issues.length).toBeGreaterThanOrEqual(4);
    }
  });

  it("rejects two releases declaring the same version", async () => {
    await mkdir(dir, { recursive: true });
    await writeRelease(
      "v1.0.0.md",
      'version: "1.0.0"\ntitle: "One"\ndate: 2026-01-01\ndocsVersion: "v1"\nstatus: "stable"\nsummary: "One."',
    );
    await writeRelease(
      "v1.0.0-again.md",
      'version: "1.0.0"\ntitle: "One again"\ndate: 2026-01-02\ndocsVersion: "v1"\nstatus: "stable"\nsummary: "One again."',
    );

    const { getAllReleases, clearChangelogCache } = await import("@/lib/changelog/loader");
    const { DuplicateReleaseError } = await import("@/lib/changelog/errors");
    clearChangelogCache();
    await expect(getAllReleases()).rejects.toBeInstanceOf(DuplicateReleaseError);
  });

  it("normalizes an unquoted numeric version and unquoted YAML date", async () => {
    await writeFile(
      path.join(dir, "v1.0.0.md"),
      ["---", 'title: "One"', "date: 2026-01-01", 'docsVersion: "v1"', 'status: "stable"', 'summary: "One."', "version: 1.0.0", "---", "", "## Features", "", "Stuff."].join("\n"),
      "utf-8",
    );

    const { getAllReleaseMeta, clearChangelogCache } = await import("@/lib/changelog/loader");
    clearChangelogCache();
    const metas = await getAllReleaseMeta();
    expect(metas[0]?.version).toBe("1.0.0");
    expect(metas[0]?.date).toBe("2026-01-01");
  });

  it("resolves adjacent releases in newest-first order", async () => {
    await writeRelease(
      "v1.0.0.md",
      'version: "1.0.0"\ntitle: "One"\ndate: 2026-01-01\ndocsVersion: "v1"\nstatus: "stable"\nsummary: "One."',
    );
    await writeRelease(
      "v2.0.0.md",
      'version: "2.0.0"\ntitle: "Two"\ndate: 2026-03-01\ndocsVersion: "v1"\nstatus: "stable"\nsummary: "Two."',
    );

    const { getAdjacentReleases, clearChangelogCache } = await import("@/lib/changelog/loader");
    clearChangelogCache();
    const { previous, next } = await getAdjacentReleases("v2.0.0");
    expect(previous?.slug).toBe("v1.0.0");
    expect(next).toBeNull();
  });
});
