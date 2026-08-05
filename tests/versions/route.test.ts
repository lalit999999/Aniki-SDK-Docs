import { describe, expect, it } from "vitest";

import { docsIndexRoute, resolveDocsPath } from "@/lib/versions/route";
import { getLatestVersion } from "@/lib/versions/registry";

describe("resolveDocsPath", () => {
  const latestId = getLatestVersion().id;

  it("resolves [] to the latest version's index", () => {
    expect(resolveDocsPath([])).toEqual({ versionId: latestId, docSlug: null });
  });

  it("resolves a single non-version segment to a doc slug in the latest version", () => {
    expect(resolveDocsPath(["introduction"])).toEqual({ versionId: latestId, docSlug: "introduction" });
  });

  it("resolves a single known-version segment to that version's index", () => {
    expect(resolveDocsPath([latestId])).toEqual({ versionId: latestId, docSlug: null });
  });

  it("resolves [version, slug] to that version's doc", () => {
    expect(resolveDocsPath([latestId, "introduction"])).toEqual({
      versionId: latestId,
      docSlug: "introduction",
    });
  });

  it("returns null for [version, a, b] - too many segments", () => {
    expect(resolveDocsPath([latestId, "a", "b"])).toBeNull();
  });

  it("returns null for [not-a-version, x] - too many segments against the latest version", () => {
    expect(resolveDocsPath(["not-a-version", "x"])).toBeNull();
  });

  it("returns null for three or more segments regardless of version prefix", () => {
    expect(resolveDocsPath(["a", "b", "c"])).toBeNull();
  });
});

describe("docsIndexRoute", () => {
  it("routes the latest version unprefixed", () => {
    expect(docsIndexRoute(getLatestVersion().id)).toBe("/docs");
  });
});
