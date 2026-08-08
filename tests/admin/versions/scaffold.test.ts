/**
 * Exercises `scaffoldVersion`'s atomic write/rollback sequence (D4) against
 * disposable temp directories - a temp content root (via `ANIKI_CONTENT_DIR`,
 * the same override the loader itself already supports) and a temp copy of
 * `config/versions.ts` (via `scaffoldVersion`'s `registryFilePath` option) -
 * so no test ever touches the real repository's `content/docs` or
 * `config/versions.ts`. The rollback tests are the point of this suite:
 * a validation failure or a mid-write filesystem failure must leave both
 * untouched.
 */
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("node:fs/promises", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs/promises")>();
  return { ...actual, rename: vi.fn(actual.rename) };
});

const REGISTRY_TEMPLATE = `import type { DocsVersion } from "@/lib/versions/types";

export const DOCS_VERSIONS: readonly DocsVersion[] = [
  // aniki:versions:start
  {
    id: "v1",
    label: "v1.0",
    status: "latest",
    releasedAt: "2026-08-03",
    sdkVersion: "0.1.x",
  },
  // aniki:versions:end
];
`;

const README_CONTENT = `---
title: Overview
description: Overview page.
category: Getting Started
order: 0
---

# Overview

Source content.
`;

const BASE_VERSIONS = [{ id: "v1", label: "v1.0", status: "latest" as const, releasedAt: "2026-08-03" }];

let contentRoot: string;
let registryDir: string;
let registryFilePath: string;

async function readRegionEntries(): Promise<{ id: string; status: string }[]> {
  const source = await readFile(registryFilePath, "utf-8");
  const registryModule = (await import(
    /* @vite-ignore */ pathToFileURL(registryFilePath).href + `?t=${Date.now()}`
  )) as {
    DOCS_VERSIONS: { id: string; status: string }[];
  };
  expect(source).toContain("aniki:versions:start");
  return registryModule.DOCS_VERSIONS;
}

beforeEach(async () => {
  contentRoot = await mkdtemp(path.join(tmpdir(), "aniki-scaffold-content-"));
  await mkdir(path.join(contentRoot, "v1"), { recursive: true });
  await writeFile(path.join(contentRoot, "v1", "README.md"), README_CONTENT, "utf-8");

  registryDir = await mkdtemp(path.join(tmpdir(), "aniki-scaffold-registry-"));
  registryFilePath = path.join(registryDir, "versions.ts");
  await writeFile(registryFilePath, REGISTRY_TEMPLATE, "utf-8");

  vi.stubEnv("ANIKI_CONTENT_DIR", contentRoot);
  vi.resetModules();
  vi.doMock("@/config/versions", () => ({ DOCS_VERSIONS: BASE_VERSIONS }));
});

afterEach(async () => {
  vi.unstubAllEnvs();
  vi.doUnmock("@/config/versions");
  vi.resetModules();
  await rm(contentRoot, { recursive: true, force: true });
  await rm(registryDir, { recursive: true, force: true });
});

describe("scaffoldVersion", () => {
  it("writes both the registry region and the content directory on the happy path", async () => {
    const { scaffoldVersion } = await import("@/lib/admin/versions/scaffold");

    const result = await scaffoldVersion(
      { id: "v2", label: "v2.0", releasedAt: "2026-09-01", sourceVersionId: "v1", promoteToLatest: false },
      { registryFilePath },
    );

    expect(result.versions.map((v) => v.id)).toEqual(["v2", "v1"]);

    const copied = await readFile(path.join(contentRoot, "v2", "README.md"), "utf-8");
    expect(copied).toBe(README_CONTENT);

    const entries = await readRegionEntries();
    expect(entries.map((e) => e.id)).toEqual(["v2", "v1"]);
  });

  it("promoting to latest demotes the previous latest to maintenance", async () => {
    const { scaffoldVersion } = await import("@/lib/admin/versions/scaffold");

    const result = await scaffoldVersion(
      { id: "v2", label: "v2.0", releasedAt: "2026-09-01", sourceVersionId: "v1", promoteToLatest: true },
      { registryFilePath },
    );

    const v1 = result.versions.find((v) => v.id === "v1");
    const v2 = result.versions.find((v) => v.id === "v2");
    expect(v1?.status).toBe("maintenance");
    expect(v2?.status).toBe("latest");

    const entries = await readRegionEntries();
    expect(entries.find((e) => e.id === "v1")?.status).toBe("maintenance");
    expect(entries.find((e) => e.id === "v2")?.status).toBe("latest");
  });

  it("writes nothing when input validation fails (duplicate id)", async () => {
    const { scaffoldVersion } = await import("@/lib/admin/versions/scaffold");
    const { InvalidVersionInputError } = await import("@/lib/admin/versions/errors");

    const before = await readFile(registryFilePath, "utf-8");

    await expect(
      scaffoldVersion(
        { id: "v1", label: "v1 again", releasedAt: "2026-09-01", sourceVersionId: "v1", promoteToLatest: false },
        { registryFilePath },
      ),
    ).rejects.toBeInstanceOf(InvalidVersionInputError);

    const after = await readFile(registryFilePath, "utf-8");
    expect(after).toBe(before);

    const contentEntries = await readdir(contentRoot);
    expect(contentEntries).toEqual(["v1"]);
  });

  it("refuses to run when the registry and content directories are already drifted", async () => {
    vi.doMock("@/config/versions", () => ({
      DOCS_VERSIONS: [...BASE_VERSIONS, { id: "v9", label: "v9.0", status: "maintenance", releasedAt: "2025-01-01" }],
    }));
    vi.resetModules();
    const { scaffoldVersion } = await import("@/lib/admin/versions/scaffold");
    const { InvalidVersionInputError } = await import("@/lib/admin/versions/errors");

    const before = await readFile(registryFilePath, "utf-8");

    await expect(
      scaffoldVersion(
        { id: "v2", label: "v2.0", releasedAt: "2026-09-01", sourceVersionId: "v1", promoteToLatest: false },
        { registryFilePath },
      ),
    ).rejects.toBeInstanceOf(InvalidVersionInputError);

    const after = await readFile(registryFilePath, "utf-8");
    expect(after).toBe(before);
  });

  it("restores the original registry file and removes the temp directory when the final rename fails", async () => {
    const fsPromises = await import("node:fs/promises");
    const { scaffoldVersion } = await import("@/lib/admin/versions/scaffold");
    const { VersionScaffoldError } = await import("@/lib/admin/versions/errors");

    const before = await readFile(registryFilePath, "utf-8");
    vi.mocked(fsPromises.rename).mockRejectedValueOnce(new Error("simulated rename failure"));

    await expect(
      scaffoldVersion(
        { id: "v2", label: "v2.0", releasedAt: "2026-09-01", sourceVersionId: "v1", promoteToLatest: false },
        { registryFilePath },
      ),
    ).rejects.toBeInstanceOf(VersionScaffoldError);

    const after = await readFile(registryFilePath, "utf-8");
    expect(after).toBe(before);

    const contentEntries = await readdir(contentRoot);
    expect(contentEntries).toEqual(["v1"]);
  });
});
