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

  const base = {
    title: "Old Page",
    description: "An old page.",
    category: "Reference" as const,
    order: 1,
  };

  it("accepts a valid deprecated block", () => {
    const result = parseFrontmatter(
      {
        ...base,
        deprecated: true,
        deprecatedSince: "2026-01-01",
        deprecatedReason: "Superseded by the new page.",
        replacedBy: "new-page",
      },
      "content/docs/old-page.md",
    );
    expect(result.deprecated).toBe(true);
    expect(result.deprecatedSince).toBe("2026-01-01");
    expect(result.replacedBy).toBe("new-page");
  });

  it("normalizes an unquoted YAML date in deprecatedSince (T9)", () => {
    const result = parseFrontmatter(
      { ...base, deprecated: true, deprecatedSince: new Date("2026-01-01") },
      "content/docs/old-page.md",
    );
    expect(result.deprecatedSince).toBe("2026-01-01");
  });

  it("rejects deprecatedSince/deprecatedReason/replacedBy without deprecated: true", () => {
    try {
      parseFrontmatter(
        {
          ...base,
          deprecatedSince: "2026-01-01",
          deprecatedReason: "Old.",
          replacedBy: "new-page",
        },
        "content/docs/old-page.md",
      );
      expect.unreachable("expected parseFrontmatter to throw");
    } catch (error) {
      expect(error).toBeInstanceOf(FrontmatterValidationError);
      const issues = (error as FrontmatterValidationError).context.issues as string[];
      expect(issues.some((issue) => issue.startsWith("deprecatedSince:"))).toBe(true);
      expect(issues.some((issue) => issue.startsWith("deprecatedReason:"))).toBe(true);
      expect(issues.some((issue) => issue.startsWith("replacedBy:"))).toBe(true);
    }
  });

  it("rejects a malformed deprecatedSince date", () => {
    expect(() =>
      parseFrontmatter(
        { ...base, deprecated: true, deprecatedSince: "not-a-date" },
        "content/docs/old-page.md",
      ),
    ).toThrow(FrontmatterValidationError);
  });
});
