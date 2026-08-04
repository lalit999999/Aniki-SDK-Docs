import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { resolveLastModified } from "@/lib/content/git";

describe("resolveLastModified", () => {
  it("prefers an explicit frontmatter date over anything else", async () => {
    const result = await resolveLastModified(
      "content/docs/does-not-need-to-exist.md",
      "2026-01-15",
    );
    expect(result.source).toBe("frontmatter");
    expect(result.updatedAt).toBe(new Date("2026-01-15").toISOString());
  });

  describe("without a frontmatter date", () => {
    let dir: string;
    let filePath: string;

    beforeEach(async () => {
      dir = await mkdtemp(path.join(tmpdir(), "content-git-test-"));
      filePath = path.join(dir, "untracked.md");
      await writeFile(filePath, "# Untracked\n", "utf-8");
    });

    afterEach(async () => {
      await rm(dir, { recursive: true, force: true });
    });

    it("falls through to the filesystem mtime without throwing when git has no answer", async () => {
      const result = await resolveLastModified(filePath);
      expect(result.source).toBe("filesystem");
      expect(result.updatedAt).not.toBeNull();
    });

    it("returns null/unknown when neither git nor the filesystem can answer", async () => {
      const missingPath = path.join(dir, "does-not-exist.md");
      const result = await resolveLastModified(missingPath);
      expect(result.source).toBe("unknown");
      expect(result.updatedAt).toBeNull();
    });
  });
});
