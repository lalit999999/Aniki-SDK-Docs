import { describe, expect, it } from "vitest";

import { FrontmatterValidationError } from "@/lib/content/errors";
import { parseFrontmatter } from "@/lib/content/schema";

describe("parseFrontmatter", () => {
  it("accepts a fully valid frontmatter block", () => {
    const result = parseFrontmatter(
      {
        title: "Guides",
        description: "End-to-end tutorials.",
        category: "Reference",
        order: 2,
      },
      "content/docs/guides.md",
    );

    expect(result.title).toBe("Guides");
    expect(result.category).toBe("Reference");
    expect(result.draft).toBe(false);
    expect(result.tags).toEqual([]);
  });

  it("aggregates every failing field into one error, not just the first", () => {
    try {
      parseFrontmatter(
        { title: "", category: "Not A Real Category", order: "two" },
        "content/docs/broken.md",
      );
      expect.unreachable("expected parseFrontmatter to throw");
    } catch (error) {
      expect(error).toBeInstanceOf(FrontmatterValidationError);
      const validationError = error as FrontmatterValidationError;
      expect(validationError.context.issues).toBeInstanceOf(Array);
      const issues = validationError.context.issues as string[];
      expect(issues.length).toBeGreaterThanOrEqual(3);
      expect(issues.some((issue) => issue.startsWith("title:"))).toBe(true);
      expect(issues.some((issue) => issue.startsWith("category:"))).toBe(true);
      expect(issues.some((issue) => issue.startsWith("order:"))).toBe(true);
      expect(issues.some((issue) => issue.startsWith("description:"))).toBe(true);
    }
  });

  it("rejects an unknown category", () => {
    expect(() =>
      parseFrontmatter(
        {
          title: "X",
          description: "X",
          category: "Not A Real Category",
          order: 1,
        },
        "content/docs/x.md",
      ),
    ).toThrow(FrontmatterValidationError);
  });
});
