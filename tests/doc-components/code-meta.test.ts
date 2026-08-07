import { describe, expect, it } from "vitest";

import { parseCodeMeta } from "@/lib/doc-components/code-meta";

describe("parseCodeMeta", () => {
  it("returns all defaults for null, undefined, and blank meta", () => {
    const defaults = { title: null, showLineNumbers: false, highlightedLines: [] };
    expect(parseCodeMeta(null)).toEqual(defaults);
    expect(parseCodeMeta(undefined)).toEqual(defaults);
    expect(parseCodeMeta("   ")).toEqual(defaults);
  });

  it("extracts a quoted title", () => {
    expect(parseCodeMeta('title="agent.ts"').title).toBe("agent.ts");
  });

  it("detects the bare showLineNumbers flag", () => {
    expect(parseCodeMeta("showLineNumbers").showLineNumbers).toBe(true);
    expect(parseCodeMeta('title="agent.ts"').showLineNumbers).toBe(false);
  });

  it("expands a hyphen range", () => {
    expect(parseCodeMeta("{3-5}").highlightedLines).toEqual([3, 4, 5]);
  });

  it("normalizes a reversed range", () => {
    expect(parseCodeMeta("{5-3}").highlightedLines).toEqual([3, 4, 5]);
  });

  it("expands a comma list, deduplicated and sorted", () => {
    expect(parseCodeMeta("{5,1,3,1}").highlightedLines).toEqual([1, 3, 5]);
  });

  it("expands a mix of single lines and ranges", () => {
    expect(parseCodeMeta("{1,3-5,8}").highlightedLines).toEqual([1, 3, 4, 5, 8]);
  });

  it("parses title, showLineNumbers, and a range together, in any order", () => {
    const meta = parseCodeMeta('title="agent.ts" showLineNumbers {3-5}');
    expect(meta).toEqual({ title: "agent.ts", showLineNumbers: true, highlightedLines: [3, 4, 5] });
  });

  it("returns no highlighted lines when no range is present", () => {
    expect(parseCodeMeta('title="agent.ts"').highlightedLines).toEqual([]);
  });
});
