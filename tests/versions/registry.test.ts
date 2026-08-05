import { describe, expect, it } from "vitest";

import { VersionConfigError, UnknownVersionError } from "@/lib/versions/errors";
import {
  findVersionById,
  getLatestVersion,
  getVersionById,
  getVersions,
  isKnownVersionId,
  isLatestVersionId,
  resolveVersionId,
  validateVersions,
} from "@/lib/versions/registry";
import type { DocsVersion } from "@/lib/versions/types";

const v1: DocsVersion = { id: "v1", label: "v1.0", status: "latest", releasedAt: "2026-08-03" };
const v2: DocsVersion = { id: "v2", label: "v2.0", status: "maintenance", releasedAt: "2026-09-01" };

describe("validateVersions", () => {
  it("accepts a well-formed single-latest registry", () => {
    expect(() => validateVersions([v1])).not.toThrow();
  });

  it("accepts a newest-first multi-version registry with exactly one latest", () => {
    expect(() =>
      validateVersions([
        { ...v2, releasedAt: "2026-09-01", status: "latest" },
        { ...v1, status: "maintenance" },
      ]),
    ).not.toThrow();
  });

  it("rejects duplicate ids", () => {
    expect(() => validateVersions([v1, { ...v1 }])).toThrow(VersionConfigError);
  });

  it("rejects zero latest versions", () => {
    expect(() => validateVersions([{ ...v1, status: "maintenance" }])).toThrow(VersionConfigError);
  });

  it("rejects two latest versions", () => {
    expect(() =>
      validateVersions([v1, { ...v2, status: "latest", releasedAt: "2025-01-01" }]),
    ).toThrow(VersionConfigError);
  });

  it("rejects a malformed version id", () => {
    expect(() => validateVersions([{ ...v1, id: "version-1" }])).toThrow(VersionConfigError);
  });

  it("rejects entries not ordered newest-first", () => {
    expect(() =>
      validateVersions([
        { ...v1, status: "maintenance", releasedAt: "2026-01-01" },
        { ...v2, status: "latest", releasedAt: "2026-09-01" },
      ]),
    ).toThrow(VersionConfigError);
  });

  it("aggregates multiple violations into one error", () => {
    try {
      validateVersions([
        { id: "bad id", label: "x", status: "maintenance", releasedAt: "2026-01-01" },
        { id: "bad id", label: "y", status: "maintenance", releasedAt: "2026-02-01" },
      ]);
      expect.unreachable("expected validateVersions to throw");
    } catch (error) {
      expect(error).toBeInstanceOf(VersionConfigError);
      const violations = (error as VersionConfigError).context.violations as string[];
      expect(violations.length).toBeGreaterThan(1);
    }
  });
});

describe("registry accessors (against the real config/versions.ts)", () => {
  it("lists at least one version", () => {
    expect(getVersions().length).toBeGreaterThan(0);
  });

  it("getLatestVersion returns the version with status latest", () => {
    expect(getLatestVersion().status).toBe("latest");
  });

  it("getVersionById resolves a known id", () => {
    const latest = getLatestVersion();
    expect(getVersionById(latest.id).id).toBe(latest.id);
  });

  it("getVersionById throws UnknownVersionError for an unknown id", () => {
    expect(() => getVersionById("v999")).toThrow(UnknownVersionError);
  });

  it("findVersionById returns null for an unknown id", () => {
    expect(findVersionById("v999")).toBeNull();
  });

  it("isKnownVersionId / isLatestVersionId agree with the registry", () => {
    const latest = getLatestVersion();
    expect(isKnownVersionId(latest.id)).toBe(true);
    expect(isKnownVersionId("v999")).toBe(false);
    expect(isLatestVersionId(latest.id)).toBe(true);
  });

  it("resolveVersionId defaults to latest when omitted", () => {
    expect(resolveVersionId()).toBe(getLatestVersion().id);
  });

  it("resolveVersionId passes through a known id and throws for an unknown one", () => {
    const latest = getLatestVersion();
    expect(resolveVersionId(latest.id)).toBe(latest.id);
    expect(() => resolveVersionId("v999")).toThrow(UnknownVersionError);
  });
});
