import { describe, expect, it } from "vitest";

import type { DocFrontmatter } from "@/lib/content";
import {
  parseDocumentFile,
  serializeDocument,
  serializeFrontmatter,
} from "@/lib/admin/content/frontmatter";

const FILE_PATH = "content/docs/v1/test-page.md";

function roundTrip(frontmatter: DocFrontmatter, body = "# Title\n\nBody text."): DocFrontmatter {
  const source = serializeDocument(frontmatter, body);
  return parseDocumentFile(source, FILE_PATH).frontmatter;
}

const BASE: DocFrontmatter = {
  title: "Tools",
  description: "Built-in tools.",
  category: "Reference",
  order: 3,
};

describe("serializeDocument / parseDocumentFile round-trip", () => {
  it("round-trips a minimal frontmatter block unchanged", () => {
    // docFrontmatterSchema's optional fields carry `.default()`s, so a
    // read-back through parseDocumentFile always fills draft/tags/deprecated
    // in even when the source omitted them - the omission only controls
    // what serializeFrontmatter *writes*, not what a strict parse returns.
    expect(roundTrip(BASE)).toEqual({ ...BASE, draft: false, tags: [], deprecated: false });
  });

  it("round-trips every canonical field unchanged", () => {
    const full: DocFrontmatter = {
      title: "Old Tools",
      description: "The old tools page.",
      category: "Reference",
      order: 5,
      updated: "2026-08-03",
      slug: "old-tools",
      draft: true,
      tags: ["cli", "sdk"],
      deprecated: true,
      deprecatedSince: "2026-01-01",
      deprecatedReason: "Superseded by the new tools page.",
      replacedBy: "tools",
      since: "v1",
    };
    expect(roundTrip(full)).toEqual(full);
  });

  it("regression: an unquoted-looking date still round-trips as a string, not a Date (T5)", () => {
    const frontmatter: DocFrontmatter = { ...BASE, updated: "2026-08-03" };
    const source = serializeDocument(frontmatter, "Body.");
    expect(source).toContain('updated: "2026-08-03"');
    const parsed = parseDocumentFile(source, FILE_PATH);
    expect(parsed.frontmatter.updated).toBe("2026-08-03");
    expect(typeof parsed.frontmatter.updated).toBe("string");
  });

  it("regression: deprecatedSince is always quoted too", () => {
    const frontmatter: DocFrontmatter = {
      ...BASE,
      deprecated: true,
      deprecatedSince: "2025-12-01",
    };
    const source = serializeDocument(frontmatter, "Body.");
    expect(source).toContain('deprecatedSince: "2025-12-01"');
  });

  it("a description containing \": \" survives", () => {
    const frontmatter: DocFrontmatter = { ...BASE, description: "Note: read this first." };
    expect(roundTrip(frontmatter).description).toBe("Note: read this first.");
  });

  it("a title that is exactly \"yes\" survives as a string, not a boolean", () => {
    const frontmatter: DocFrontmatter = { ...BASE, title: "yes" };
    const result = roundTrip(frontmatter);
    expect(result.title).toBe("yes");
    expect(typeof result.title).toBe("string");
  });

  it("a title that looks numeric survives as a string", () => {
    const frontmatter: DocFrontmatter = { ...BASE, title: "1.0" };
    const result = roundTrip(frontmatter);
    expect(result.title).toBe("1.0");
    expect(typeof result.title).toBe("string");
  });

  it("tags survive as a flow sequence", () => {
    const frontmatter: DocFrontmatter = { ...BASE, tags: ["a", "b"] };
    const source = serializeDocument(frontmatter, "Body.");
    expect(source).toContain('tags: ["a", "b"]');
    expect(roundTrip(frontmatter).tags).toEqual(["a", "b"]);
  });

  it("normalizes CRLF line endings and trailing whitespace in the body", () => {
    const source = serializeDocument(BASE, "# Title\r\n\r\nBody.\r\n\r\n\r\n");
    expect(source.includes("\r")).toBe(false);
    expect(source.endsWith("Body.\n")).toBe(true);
  });
});

describe("serializeFrontmatter", () => {
  it("emits fields in the canonical D7 order", () => {
    const full: DocFrontmatter = {
      title: "Old Tools",
      description: "The old tools page.",
      category: "Reference",
      order: 5,
      updated: "2026-08-03",
      slug: "old-tools",
      draft: true,
      tags: ["cli"],
      deprecated: true,
      deprecatedSince: "2026-01-01",
      deprecatedReason: "Superseded.",
      replacedBy: "tools",
      since: "v1",
    };
    const keys = serializeFrontmatter(full)
      .split("\n")
      .filter((line) => line.length > 0)
      .map((line) => line.split(":")[0]);
    expect(keys).toEqual([
      "title",
      "description",
      "category",
      "order",
      "updated",
      "slug",
      "draft",
      "tags",
      "deprecated",
      "deprecatedSince",
      "deprecatedReason",
      "replacedBy",
      "since",
    ]);
  });

  it("is stable across repeated calls with the same object", () => {
    const a = serializeFrontmatter(BASE);
    const b = serializeFrontmatter(BASE);
    expect(a).toBe(b);
  });

  it("omits default-valued optional fields", () => {
    const frontmatter: DocFrontmatter = { ...BASE, draft: false, tags: [], deprecated: false };
    const yaml = serializeFrontmatter(frontmatter);
    expect(yaml).not.toContain("draft");
    expect(yaml).not.toContain("tags");
    expect(yaml).not.toContain("deprecated");
  });

  it("omits undefined optional fields", () => {
    const yaml = serializeFrontmatter(BASE);
    expect(yaml).not.toContain("updated");
    expect(yaml).not.toContain("slug");
    expect(yaml).not.toContain("replacedBy");
    expect(yaml).not.toContain("since");
  });

  it("produces a one-line diff when only one field changes", () => {
    const before = serializeFrontmatter(BASE).split("\n");
    const after = serializeFrontmatter({ ...BASE, order: 9 }).split("\n");
    const changedLines = before.filter((line, index) => line !== after[index]);
    expect(changedLines).toEqual(["order: 3"]);
  });
});
