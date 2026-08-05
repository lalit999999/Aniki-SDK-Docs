import { describe, expect, it } from "vitest";

import { buildSnippet, highlight } from "@/lib/search/highlight";

describe("highlight", () => {
  it("returns a single unmatched segment when nothing matches", () => {
    expect(highlight("no match here", ["zzz"])).toEqual([{ text: "no match here", match: false }]);
  });

  it("preserves original casing and accents while matching diacritic-insensitively", () => {
    const segments = highlight("Café Résumé", ["cafe"]);
    expect(segments).toEqual([
      { text: "Café", match: true },
      { text: " Résumé", match: false },
    ]);
  });

  it("merges overlapping matches from different tokens into one segment", () => {
    const segments = highlight("generateText streaming", ["generate", "text"]);
    expect(segments).toEqual([
      { text: "generateText", match: true },
      { text: " streaming", match: false },
    ]);
  });

  it("matches case-insensitively", () => {
    const segments = highlight("Streaming Responses", ["streaming"]);
    expect(segments[0]).toEqual({ text: "Streaming", match: true });
  });

  it("returns the whole text unmatched for an empty token list", () => {
    expect(highlight("some text", [])).toEqual([{ text: "some text", match: false }]);
  });
});

describe("buildSnippet", () => {
  it("windows around the first match and flags both truncation sides", () => {
    // Word-separated padding (not one giant unbroken run) so the
    // word-boundary expansion has somewhere to stop short of the text's
    // actual start/end - that's what makes truncation observable at all.
    const pad = "lorem ipsum dolor sit amet consectetur adipiscing elit ".repeat(5);
    const text = `${pad}stream ${pad}`;
    const snippet = buildSnippet(text, ["stream"], { radius: 20 });

    expect(snippet.segments.some((s) => s.match && s.text === "stream")).toBe(true);
    expect(snippet.truncatedStart).toBe(true);
    expect(snippet.truncatedEnd).toBe(true);
  });

  it("does not flag truncation when the whole text fits", () => {
    const snippet = buildSnippet("short text with stream in it", ["stream"], { radius: 90 });
    expect(snippet.truncatedStart).toBe(false);
    expect(snippet.truncatedEnd).toBe(false);
  });

  it("windows from the head of the text when nothing matches", () => {
    const text = "lorem ipsum dolor sit amet consectetur adipiscing elit ".repeat(5);
    const snippet = buildSnippet(text, ["zzz"], { radius: 20 });
    expect(snippet.truncatedStart).toBe(false);
    expect(snippet.truncatedEnd).toBe(true);
    expect(snippet.segments.every((s) => !s.match)).toBe(true);
  });
});
