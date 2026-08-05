import { describe, expect, it } from "vitest";

import { normalize, splitIdentifier, tokenize, tokenizeQuery } from "@/lib/search/tokenize";

describe("normalize", () => {
  it("folds diacritics and lowercases", () => {
    expect(normalize("Café Résumé")).toBe("cafe resume");
  });

  it("collapses whitespace", () => {
    expect(normalize("  hello   world  ")).toBe("hello world");
  });
});

describe("splitIdentifier", () => {
  it("splits camelCase", () => {
    expect(splitIdentifier("generateText")).toEqual(["generate", "Text"]);
  });

  it("splits PascalCase and acronym runs", () => {
    expect(splitIdentifier("HTTPServer")).toEqual(["HTTP", "Server"]);
  });

  it("splits snake_case and kebab-case", () => {
    expect(splitIdentifier("snake_case_id")).toEqual(["snake", "case", "id"]);
    expect(splitIdentifier("kebab-case-id")).toEqual(["kebab", "case", "id"]);
  });

  it("splits dotted paths", () => {
    expect(splitIdentifier("lib.search.engine")).toEqual(["lib", "search", "engine"]);
  });
});

describe("tokenize", () => {
  it("emits both the whole identifier and its parts for camelCase", () => {
    const tokens = tokenize("generateText");
    expect(tokens).toContain("generatetext");
    expect(tokens).toContain("generate");
    expect(tokens).toContain("text");
  });

  it("is diacritic-insensitive", () => {
    expect(tokenize("café")).toContain("cafe");
  });

  it("splits on punctuation", () => {
    expect(tokenize("tool-calling, streaming!")).toEqual(
      expect.arrayContaining(["tool", "calling", "streaming"]),
    );
  });

  it("deduplicates while preserving first-seen order", () => {
    const tokens = tokenize("text text generateText");
    expect(tokens.filter((t) => t === "text")).toHaveLength(1);
  });

  it("drops single-character tokens unless the whole query is one character", () => {
    expect(tokenize("a bb ccc")).toEqual(["bb", "ccc"]);
    expect(tokenize("a")).toEqual(["a"]);
  });
});

describe("tokenizeQuery", () => {
  it("returns tokens plus the normalised phrase", () => {
    expect(tokenizeQuery("Tool Calling")).toEqual({
      tokens: ["tool", "calling"],
      phrase: "tool calling",
    });
  });
});
