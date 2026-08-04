import { describe, expect, it } from "vitest";

import { createHeadingSlugger, fileNameToSlug, slugToRoute, slugToTitle } from "@/lib/content/slug";

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
});

describe("slugToRoute", () => {
  it("routes the index slug to /docs", () => {
    expect(slugToRoute("index")).toBe("/docs");
  });

  it("routes any other slug to /docs/<slug>", () => {
    expect(slugToRoute("tools")).toBe("/docs/tools");
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
