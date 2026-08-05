import { describe, expect, it } from "vitest";

import { compileSection, scoreSection } from "@/lib/search/score";
import { tokenizeQuery } from "@/lib/search/tokenize";
import type { SearchSection } from "@/lib/search/types";

function makeSection(overrides: Partial<SearchSection> = {}): SearchSection {
  return {
    id: "doc#lead",
    docSlug: "doc",
    docTitle: "Streaming Responses",
    docDescription: "How to stream tokens as they arrive.",
    category: "Core Concepts",
    route: "/docs/doc",
    href: "/docs/doc",
    headingId: null,
    headingText: null,
    headingLevel: null,
    content: "Basic usage of the generate function.",
    order: 0,
    ...overrides,
  };
}

describe("scoreSection", () => {
  it("scores a title hit higher than a content-only hit", () => {
    const titleHit = compileSection(makeSection({ docTitle: "Streaming Responses" }));
    const contentHit = compileSection(
      makeSection({ docTitle: "Unrelated Page", content: "This section mentions streaming in passing." }),
    );

    const query = tokenizeQuery("streaming");
    const titleScore = scoreSection(titleHit, query);
    const contentScore = scoreSection(contentHit, query);

    expect(titleScore).toBeGreaterThan(contentScore);
  });

  it("scores 0 when any query token matches nothing", () => {
    const section = compileSection(makeSection({ content: "Only mentions streaming here." }));
    const query = tokenizeQuery("streaming zzznotfound");
    expect(scoreSection(section, query)).toBe(0);
  });

  it("applies a phrase bonus for a contiguous substring match", () => {
    const withPhrase = compileSection(makeSection({ content: "Learn tool calling in this guide." }));
    const withoutPhrase = compileSection(
      makeSection({ content: "Tools are useful. Calling a function is easy." }),
    );

    const query = tokenizeQuery("tool calling");
    expect(scoreSection(withPhrase, query)).toBeGreaterThan(scoreSection(withoutPhrase, query));
  });

  it("scores an earlier match position higher than a later one", () => {
    const early = compileSection(makeSection({ content: "streaming is the topic of this whole page" }));
    const late = compileSection(
      makeSection({
        content: "this page covers many unrelated filler words before finally mentioning streaming",
      }),
    );

    const query = tokenizeQuery("streaming");
    expect(scoreSection(early, query)).toBeGreaterThanOrEqual(scoreSection(late, query));
  });

  it("returns 0 for an empty token list", () => {
    const section = compileSection(makeSection());
    expect(scoreSection(section, { tokens: [], phrase: "" })).toBe(0);
  });
});
