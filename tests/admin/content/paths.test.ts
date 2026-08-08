import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { fileNameToSlug } from "@/lib/content";
import { InvalidDocumentInputError, UnsupportedVersionError } from "@/lib/admin/content/errors";
import {
  assertKnownVersion,
  documentExists,
  resolveDocumentPath,
  slugToFileName,
  validateSlugInput,
} from "@/lib/admin/content/paths";

describe("assertKnownVersion", () => {
  it("does not throw for a declared version", () => {
    expect(() => assertKnownVersion("v1")).not.toThrow();
  });

  it("throws UnsupportedVersionError for an undeclared version", () => {
    expect(() => assertKnownVersion("v9")).toThrow(UnsupportedVersionError);
  });
});

describe("validateSlugInput", () => {
  it("accepts clean lowercase, hyphenated slugs, and \"index\"", () => {
    expect(() => validateSlugInput("quick-start")).not.toThrow();
    expect(() => validateSlugInput("index")).not.toThrow();
    expect(() => validateSlugInput("a")).not.toThrow();
  });

  it("rejects an empty slug", () => {
    expect(() => validateSlugInput("")).toThrow(InvalidDocumentInputError);
  });

  it("rejects uppercase letters", () => {
    expect(() => validateSlugInput("Quick-Start")).toThrow(InvalidDocumentInputError);
  });

  it("rejects whitespace", () => {
    expect(() => validateSlugInput("quick start")).toThrow(InvalidDocumentInputError);
  });

  it("rejects a leading hyphen", () => {
    expect(() => validateSlugInput("-quick-start")).toThrow(InvalidDocumentInputError);
  });

  it("rejects a trailing hyphen", () => {
    expect(() => validateSlugInput("quick-start-")).toThrow(InvalidDocumentInputError);
  });

  it("rejects a doubled hyphen", () => {
    expect(() => validateSlugInput("quick--start")).toThrow(InvalidDocumentInputError);
  });

  it("rejects slugs matching the reserved version id pattern", () => {
    expect(() => validateSlugInput("v2")).toThrow(InvalidDocumentInputError);
    expect(() => validateSlugInput("v1.1")).toThrow(InvalidDocumentInputError);
  });

  it("aggregates every violation into a single error, not just the first", () => {
    try {
      validateSlugInput("Bad Slug--");
      expect.unreachable("expected validateSlugInput to throw");
    } catch (error) {
      expect(error).toBeInstanceOf(InvalidDocumentInputError);
      const issues = (error as InvalidDocumentInputError).context.issues as string[];
      expect(issues.length).toBeGreaterThanOrEqual(3);
    }
  });

  it("rejects every path traversal attempt", () => {
    for (const malicious of ["../../etc/passwd", "..%2F..", "/etc/passwd", "a/b", "a\0b", "..", "."]) {
      expect(() => validateSlugInput(malicious), `expected "${malicious}" to be rejected`).toThrow(
        InvalidDocumentInputError,
      );
    }
  });
});

describe("slugToFileName", () => {
  it("maps \"index\" to \"README.md\"", () => {
    expect(slugToFileName("index")).toBe("README.md");
  });

  it("maps every other slug to \"<slug>.md\"", () => {
    expect(slugToFileName("quick-start")).toBe("quick-start.md");
  });

  it("round-trips with fileNameToSlug from lib/content", () => {
    expect(fileNameToSlug(slugToFileName("index"))).toBe("index");
    expect(fileNameToSlug(slugToFileName("quick-start"))).toBe("quick-start");
  });
});

describe("resolveDocumentPath against a fixture tree", () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(path.join(tmpdir(), "admin-content-paths-test-"));
    await mkdir(path.join(dir, "v1"), { recursive: true });
    await writeFile(path.join(dir, "v1", "README.md"), "# Index\n", "utf-8");
    vi.stubEnv("ANIKI_CONTENT_DIR", dir);
  });

  afterEach(async () => {
    vi.unstubAllEnvs();
    await rm(dir, { recursive: true, force: true });
  });

  it("resolves a valid slug under the right version directory", () => {
    expect(resolveDocumentPath("v1", "quick-start")).toBe(path.join(dir, "v1", "quick-start.md"));
    expect(resolveDocumentPath("v1", "index")).toBe(path.join(dir, "v1", "README.md"));
  });

  it("throws for an undeclared version", () => {
    expect(() => resolveDocumentPath("v9", "quick-start")).toThrow(UnsupportedVersionError);
  });

  it("rejects every path traversal attempt", () => {
    for (const malicious of ["../../etc/passwd", "..%2F..", "/etc/passwd", "a/b", "a\0b"]) {
      expect(() => resolveDocumentPath("v1", malicious), `expected "${malicious}" to be rejected`).toThrow(
        InvalidDocumentInputError,
      );
    }
  });

  it("documentExists reflects the fixture tree", async () => {
    await expect(documentExists("v1", "index")).resolves.toBe(true);
    await expect(documentExists("v1", "quick-start")).resolves.toBe(false);
  });
});
