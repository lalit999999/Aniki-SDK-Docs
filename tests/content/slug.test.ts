import { describe, expect, it } from "vitest";

import { ReservedSlugError } from "@/lib/content/errors";
import { createHeadingSlugger, fileNameToSlug, slugToRoute, slugToVersionedRoute, slugToTitle } from "@/lib/content/slug";
import { getLatestVersion } from "@/lib/versions/registry";

describe("fileNameToSlug", () => {
  it("maps README.md to the index slug", () => {
    expect(fileNameToSlug("README.md")).toBe("index");
  });

  it("lowercases and strips the extension for normal filenames", () => {
    expect(fileNameToSlug("quick-start.md")).toBe("quick-start");
    expect(fileNameToSlug("tools.md")).toBe("tools");
  });

  it("rejects a filename that can't produce a clean slug", () => {
    expect(() => fileNameToSlug("My File.md")).toThrow();
    expect(() => fileNameToSlug("Under_Score.md")).toThrow();
  });

  it("rejects a slug matching the version id pattern with ReservedSlugError", () => {
    expect(() => fileNameToSlug("v2.md")).toThrow(ReservedSlugError);
  });

  it("still allows a slug that merely starts with v but isn't a version id", () => {
    expect(fileNameToSlug("validation.md")).toBe("validation");
  });
});

describe("slugToRoute", () => {
  const latestId = getLatestVersion().id;

  it("routes the index slug to /docs", () => {
    expect(slugToRoute("index")).toBe("/docs");
  });

  it("routes any other slug to /docs/<slug>", () => {
    expect(slugToRoute("tools")).toBe("/docs/tools");
  });

  it("routes the latest version's slug unprefixed even when versionId is given explicitly", () => {
    expect(slugToRoute("index", latestId)).toBe("/docs");
    expect(slugToRoute("tools", latestId)).toBe("/docs/tools");
  });
});

describe("slugToVersionedRoute", () => {
  it("always prefixes with the version id, even for the latest version", () => {
    const latestId = getLatestVersion().id;
    expect(slugToVersionedRoute("index", latestId)).toBe(`/docs/${latestId}`);
    expect(slugToVersionedRoute("tools", latestId)).toBe(`/docs/${latestId}/tools`);
  });
});

describe("slugToTitle", () => {
  it("title-cases a hyphenated slug", () => {
    expect(slugToTitle("quick-start")).toBe("Quick Start");
  });
});

describe("createHeadingSlugger", () => {
  it("deduplicates repeated heading text GitHub-style", () => {
    const slugger = createHeadingSlugger();
    expect(slugger.slug("Goal")).toBe("goal");
    expect(slugger.slug("Goal")).toBe("goal-1");
    expect(slugger.slug("Goal")).toBe("goal-2");
  });

  it("is scoped to a single instance - a fresh slugger resets dedup state", () => {
    const first = createHeadingSlugger();
    first.slug("Overview");
    first.slug("Overview");

    const second = createHeadingSlugger();
    expect(second.slug("Overview")).toBe("overview");
  });
});
