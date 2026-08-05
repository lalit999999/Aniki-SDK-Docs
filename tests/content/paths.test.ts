import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  assertVersionDirectories,
  getContentDirectory,
  getContentRoot,
  listDocFiles,
  listVersionDirectories,
} from "@/lib/content/paths";
import { VersionConfigError } from "@/lib/versions/errors";

describe("content paths against a fixture tree", () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(path.join(tmpdir(), "content-paths-test-"));
    await mkdir(path.join(dir, "v1"), { recursive: true });
    await writeFile(path.join(dir, "v1", "introduction.md"), "# Introduction\n", "utf-8");
    await writeFile(path.join(dir, "v1", "_draft.md"), "# Draft\n", "utf-8");
    await writeFile(path.join(dir, "v1", ".hidden.md"), "# Hidden\n", "utf-8");
    vi.stubEnv("ANIKI_CONTENT_DIR", dir);
  });

  afterEach(async () => {
    vi.unstubAllEnvs();
    await rm(dir, { recursive: true, force: true });
  });

  it("getContentRoot reads ANIKI_CONTENT_DIR", () => {
    expect(getContentRoot()).toBe(dir);
  });

  it("getContentDirectory resolves the latest version by default", () => {
    expect(getContentDirectory()).toBe(path.join(dir, "v1"));
    expect(getContentDirectory("v1")).toBe(path.join(dir, "v1"));
  });

  it("listVersionDirectories ignores dot/underscore-prefixed entries and non-directories", async () => {
    await writeFile(path.join(dir, "_ignored"), "not a dir", "utf-8");
    await mkdir(path.join(dir, ".hidden-dir"));
    expect(await listVersionDirectories()).toEqual(["v1"]);
  });

  it("listDocFiles ignores dot/underscore-prefixed markdown files", async () => {
    const files = await listDocFiles("v1");
    expect(files).toEqual([path.join(dir, "v1", "introduction.md")]);
  });

  it("assertVersionDirectories passes when the fixture matches the real registry (v1 only)", async () => {
    await expect(assertVersionDirectories()).resolves.toBeUndefined();
  });

  it("assertVersionDirectories throws when a directory exists with no declared version", async () => {
    await mkdir(path.join(dir, "v2"));
    await expect(assertVersionDirectories()).rejects.toBeInstanceOf(VersionConfigError);
  });

  it("assertVersionDirectories throws when a declared version has no directory", async () => {
    await rm(path.join(dir, "v1"), { recursive: true, force: true });
    await expect(assertVersionDirectories()).rejects.toBeInstanceOf(VersionConfigError);
  });
});
