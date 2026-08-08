import { mkdir, mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { DocFrontmatter } from "@/lib/content";
import { ContentNotFoundError } from "@/lib/content";
import {
  DocumentExistsError,
  IndexIntegrityError,
  InvalidDocumentInputError,
} from "@/lib/admin/content/errors";
import {
  createDocument,
  deleteDocument,
  listStoredDocuments,
  readStoredDocument,
  updateDocument,
  validateDocument,
} from "@/lib/admin/content/writer";
import type { DocumentDraft } from "@/lib/admin/content/types";

const TOOLS_FRONTMATTER: DocFrontmatter = {
  title: "Tools",
  description: "Built-in tools.",
  category: "Reference",
  order: 2,
};

const LEGACY_TOOLS_FRONTMATTER: DocFrontmatter = {
  title: "Old Tools",
  description: "The old tools page.",
  category: "Reference",
  order: 3,
  deprecated: true,
  replacedBy: "tools",
};

function frontmatterBlock(frontmatter: DocFrontmatter): string {
  const lines = [
    `title: ${frontmatter.title}`,
    `description: ${frontmatter.description}`,
    `category: ${frontmatter.category}`,
    `order: ${frontmatter.order}`,
  ];
  if (frontmatter.deprecated === true) lines.push("deprecated: true");
  if (frontmatter.replacedBy !== undefined) lines.push(`replacedBy: ${frontmatter.replacedBy}`);
  return `---\n${lines.join("\n")}\n---\n\n# ${frontmatter.title}\n\nBody.\n`;
}

async function seedFixtureTree(): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), "admin-content-writer-test-"));
  await mkdir(path.join(dir, "v1"), { recursive: true });
  await writeFile(path.join(dir, "v1", "README.md"), "---\ntitle: Index\ndescription: Home.\ncategory: Getting Started\norder: 1\n---\n\n# Index\n\nWelcome.\n", "utf-8");
  await writeFile(path.join(dir, "v1", "tools.md"), frontmatterBlock(TOOLS_FRONTMATTER), "utf-8");
  await writeFile(path.join(dir, "v1", "legacy-tools.md"), frontmatterBlock(LEGACY_TOOLS_FRONTMATTER), "utf-8");
  return dir;
}

describe("writer against a fixture tree", () => {
  let dir: string;

  beforeEach(async () => {
    dir = await seedFixtureTree();
    vi.stubEnv("ANIKI_CONTENT_DIR", dir);
  });

  afterEach(async () => {
    vi.unstubAllEnvs();
    await rm(dir, { recursive: true, force: true });
  });

  it("listStoredDocuments reads every document regardless of draft status", async () => {
    const docs = await listStoredDocuments("v1");
    expect(docs.map((doc) => doc.slug).sort()).toEqual(["index", "legacy-tools", "tools"]);
  });

  it("readStoredDocument returns null for an unknown slug", async () => {
    await expect(readStoredDocument("v1", "does-not-exist")).resolves.toBeNull();
  });

  it("readStoredDocument returns the parsed document for a known slug", async () => {
    const doc = await readStoredDocument("v1", "tools");
    expect(doc?.frontmatter.title).toBe("Tools");
  });

  it("createDocument writes a new file and clears the cache", async () => {
    const draft: DocumentDraft = {
      version: "v1",
      slug: "guides",
      frontmatter: { title: "Guides", description: "How to use it.", category: "Core Concepts", order: 1 },
      body: "# Guides\n\nBody text.",
    };
    const result = await createDocument(draft);
    expect(result.changed).toBe(true);

    const doc = await readStoredDocument("v1", "guides");
    expect(doc?.frontmatter.title).toBe("Guides");
  });

  it("createDocument rejects a slug that already exists", async () => {
    const draft: DocumentDraft = {
      version: "v1",
      slug: "tools",
      frontmatter: TOOLS_FRONTMATTER,
      body: "# Tools\n\nBody.",
    };
    await expect(createDocument(draft)).rejects.toThrow(DocumentExistsError);
  });

  it("createDocument rejects an invalid draft and leaves no temp files behind", async () => {
    const draft = {
      version: "v1",
      slug: "broken",
      frontmatter: { title: "Broken", description: "", category: "Reference", order: 1 },
      body: "Body.",
    } as unknown as DocumentDraft;

    await expect(createDocument(draft)).rejects.toThrow(InvalidDocumentInputError);

    const entries = await readdir(path.join(dir, "v1"));
    expect(entries.some((entry) => entry.startsWith("."))).toBe(false);
  });

  it("updateDocument overwrites an existing document", async () => {
    const draft: DocumentDraft = {
      version: "v1",
      slug: "tools",
      frontmatter: { ...TOOLS_FRONTMATTER, order: 9 },
      body: "# Tools\n\nUpdated body.",
    };
    await updateDocument(draft);

    const doc = await readStoredDocument("v1", "tools");
    expect(doc?.frontmatter.order).toBe(9);
    expect(doc?.body).toContain("Updated body.");
  });

  it("updateDocument rejects an unknown slug", async () => {
    const draft: DocumentDraft = {
      version: "v1",
      slug: "does-not-exist",
      frontmatter: TOOLS_FRONTMATTER,
      body: "Body.",
    };
    await expect(updateDocument(draft)).rejects.toThrow(ContentNotFoundError);
  });

  it("deleteDocument removes a document with no referrers", async () => {
    const draft: DocumentDraft = {
      version: "v1",
      slug: "guides",
      frontmatter: { title: "Guides", description: "How to use it.", category: "Core Concepts", order: 1 },
      body: "# Guides\n\nBody.",
    };
    await createDocument(draft);

    await deleteDocument("v1", "guides");
    await expect(readStoredDocument("v1", "guides")).resolves.toBeNull();
  });

  it("deleteDocument rejects deleting the index page", async () => {
    await expect(deleteDocument("v1", "index")).rejects.toThrow(IndexIntegrityError);
  });

  it("deleteDocument rejects deleting a page another page's replacedBy still points at, naming the referrer", async () => {
    try {
      await deleteDocument("v1", "tools");
      expect.unreachable("expected deleteDocument to throw");
    } catch (error) {
      expect(error).toBeInstanceOf(IndexIntegrityError);
      const conflicts = (error as IndexIntegrityError).context.conflicts as string[];
      expect(conflicts.some((conflict) => conflict.includes("legacy-tools.md"))).toBe(true);
    }
  });

  it("deleteDocument rejects an unknown slug", async () => {
    await expect(deleteDocument("v1", "does-not-exist")).rejects.toThrow(ContentNotFoundError);
  });

  it("validateDocument aggregates schema and slug issues in one call", async () => {
    const draft = {
      version: "v1",
      slug: "Bad Slug",
      frontmatter: { title: "", description: "", category: "Reference", order: 1 },
      body: "Body.",
    } as unknown as DocumentDraft;

    const report = await validateDocument(draft);
    expect(report.valid).toBe(false);
    expect(report.issues.length).toBeGreaterThanOrEqual(2);
  });

  it("validateDocument rejects a dangling replacedBy pointer", async () => {
    const draft: DocumentDraft = {
      version: "v1",
      slug: "guides",
      frontmatter: {
        title: "Guides",
        description: "How to use it.",
        category: "Core Concepts",
        order: 1,
        deprecated: true,
        replacedBy: "does-not-exist",
      },
      body: "Body.",
    };
    const report = await validateDocument(draft);
    expect(report.valid).toBe(false);
    expect(report.issues.some((issue) => issue.includes("replacedBy"))).toBe(true);
  });
});

describe("writer duplicate-slug detection (T2)", () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(path.join(tmpdir(), "admin-content-writer-dup-test-"));
    await mkdir(path.join(dir, "v1"), { recursive: true });
    // A lowercase "readme.md" collapses to the same "index" slug as
    // "README.md" (T2) - fileNameToSlug lowercases before comparing.
    await writeFile(path.join(dir, "v1", "readme.md"), "---\ntitle: Index\ndescription: Home.\ncategory: Getting Started\norder: 1\n---\n\n# Index\n\nBody.\n", "utf-8");
    vi.stubEnv("ANIKI_CONTENT_DIR", dir);
  });

  afterEach(async () => {
    vi.unstubAllEnvs();
    await rm(dir, { recursive: true, force: true });
  });

  it("flags a write that would introduce a duplicate slug", async () => {
    const draft: DocumentDraft = {
      version: "v1",
      slug: "index",
      frontmatter: { title: "Index", description: "Home.", category: "Getting Started", order: 1 },
      body: "Body.",
    };
    const report = await validateDocument(draft);
    expect(report.valid).toBe(false);
    expect(report.issues.some((issue) => issue.includes("already resolves"))).toBe(true);

    await expect(createDocument(draft)).rejects.toThrow(InvalidDocumentInputError);
  });
});

describe("writer last-page protection", () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(path.join(tmpdir(), "admin-content-writer-lastpage-test-"));
    await mkdir(path.join(dir, "v1"), { recursive: true });
    await writeFile(path.join(dir, "v1", "tools.md"), frontmatterBlock(TOOLS_FRONTMATTER), "utf-8");
    vi.stubEnv("ANIKI_CONTENT_DIR", dir);
  });

  afterEach(async () => {
    vi.unstubAllEnvs();
    await rm(dir, { recursive: true, force: true });
  });

  it("refuses to delete the last remaining page of a version", async () => {
    await expect(deleteDocument("v1", "tools")).rejects.toThrow(IndexIntegrityError);
  });
});
