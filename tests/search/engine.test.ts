import { describe, expect, it } from "vitest";

import { createSearchEngine } from "@/lib/search/engine";
import type { SearchIndex, SearchSection } from "@/lib/search/types";
import { SEARCH_INDEX_VERSION } from "@/lib/search/types";

function section(overrides: Partial<SearchSection>): SearchSection {
  return {
    id: `${overrides.docSlug ?? "doc"}#${overrides.headingId ?? "lead"}`,
    docSlug: "doc",
    docTitle: "Tools",
    docDescription: "Using tools with agents.",
    category: "Core Concepts",
    route: "/docs/doc",
    href: "/docs/doc",
    headingId: null,
    headingText: null,
    headingLevel: null,
    content: "General content about the SDK.",
    order: 0,
    ...overrides,
  };
}

function makeIndex(sections: SearchSection[]): SearchIndex {
  return { version: SEARCH_INDEX_VERSION, generatedAt: new Date().toISOString(), sections };
}

describe("createSearchEngine", () => {
  it("returns [] for queries shorter than 2 characters", () => {
    const engine = createSearchEngine(makeIndex([section({ docSlug: "a" })]));
    expect(engine.search("t")).toEqual([]);
    expect(engine.search("")).toEqual([]);
  });

  it("returns [] for a nonsense query that matches nothing", () => {
    const engine = createSearchEngine(makeIndex([section({ docSlug: "a" })]));
    expect(engine.search("zzznonexistentqqq")).toEqual([]);
  });

  it("orders tied scores deterministically by section order", () => {
    const sections = [
      section({ docSlug: "a", headingId: "one", order: 5, content: "tool usage here" }),
      section({ docSlug: "b", headingId: "two", order: 1, content: "tool usage here" }),
    ];
    const engine = createSearchEngine(makeIndex(sections));
    const results = engine.search("tool");
    expect(results.map((r) => r.section.order)).toEqual([1, 5]);
  });

  it("enforces maxPerDocument", () => {
    const sections = Array.from({ length: 5 }, (_, i) =>
      section({ docSlug: "same-doc", headingId: `h${i}`, order: i, content: "tool calling section" }),
    );
    const engine = createSearchEngine(makeIndex(sections));
    const results = engine.search("tool", { maxPerDocument: 2 });
    expect(results).toHaveLength(2);
  });

  it("enforces limit", () => {
    const sections = Array.from({ length: 5 }, (_, i) =>
      section({ docSlug: `doc-${i}`, headingId: "lead", order: i, content: "tool calling section" }),
    );
    const engine = createSearchEngine(makeIndex(sections));
    const results = engine.search("tool", { limit: 3 });
    expect(results).toHaveLength(3);
  });
});
