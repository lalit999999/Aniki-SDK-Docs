import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ContentNotFoundError } from "@/lib/content";
import {
  canPublish,
  getPublishState,
  listDocuments,
  publishDocument,
  unpublishDocument,
} from "@/lib/admin/content/workflow";
import type { DocumentDraft } from "@/lib/admin/content/types";

async function seedFixtureTree(): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), "admin-content-workflow-test-"));
  await mkdir(path.join(dir, "v1"), { recursive: true });
  await writeFile(
    path.join(dir, "v1", "README.md"),
    "---\ntitle: Index\ndescription: Home.\ncategory: Getting Started\norder: 1\n---\n\n# Index\n\nWelcome.\n",
    "utf-8",
  );
  await writeFile(
    path.join(dir, "v1", "tools.md"),
    '---\ntitle: Tools\ndescription: Built-in tools.\ncategory: Reference\norder: 2\ndraft: true\n---\n\n# Tools\n\n## Usage\n\nBody.\n',
    "utf-8",
  );
  await writeFile(
    path.join(dir, "v1", "guides.md"),
    '---\ntitle: Guides\ndescription: "How things work."\ncategory: Core Concepts\norder: 1\nupdated: "2026-01-01"\n---\n\n# Guides\n\n## Getting started\n\nBody.\n',
    "utf-8",
  );
  return dir;
}

describe("workflow against a fixture tree", () => {
  let dir: string;

  beforeEach(async () => {
    dir = await seedFixtureTree();
    vi.stubEnv("ANIKI_CONTENT_DIR", dir);
  });

  afterEach(async () => {
    vi.unstubAllEnvs();
    await rm(dir, { recursive: true, force: true });
  });

  it("getPublishState reflects the draft flag", async () => {
    await expect(getPublishState("v1", "tools")).resolves.toBe("draft");
    await expect(getPublishState("v1", "guides")).resolves.toBe("published");
  });

  it("getPublishState throws for an unknown slug", async () => {
    await expect(getPublishState("v1", "does-not-exist")).rejects.toThrow(ContentNotFoundError);
  });

  it("publishDocument clears draft and stamps updated with the injected date", async () => {
    const result = await publishDocument("v1", "tools", new Date("2026-08-08T12:00:00Z"));
    expect(result.changed).toBe(true);
    await expect(getPublishState("v1", "tools")).resolves.toBe("published");
  });

  it("publishDocument is idempotent on an already-published document", async () => {
    await publishDocument("v1", "guides", new Date("2026-08-08T12:00:00Z"));
    const result = await publishDocument("v1", "guides", new Date("2099-01-01T00:00:00Z"));
    expect(result.changed).toBe(false);
  });

  it("unpublishDocument sets draft and preserves updated", async () => {
    const result = await unpublishDocument("v1", "guides");
    expect(result.changed).toBe(true);
    await expect(getPublishState("v1", "guides")).resolves.toBe("draft");
  });

  it("unpublishDocument is idempotent on an already-draft document", async () => {
    const result = await unpublishDocument("v1", "tools");
    expect(result.changed).toBe(false);
  });

  it("listDocuments includes drafts even under NODE_ENV=production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const documents = await listDocuments("v1");
    expect(documents.some((doc) => doc.slug === "tools" && doc.draft)).toBe(true);
  });

  it("listDocuments sorts by category order then order", async () => {
    const documents = await listDocuments("v1");
    expect(documents.map((doc) => doc.slug)).toEqual(["index", "guides", "tools"]);
  });
});

describe("canPublish", () => {
  let dir: string;

  beforeEach(async () => {
    dir = await seedFixtureTree();
    vi.stubEnv("ANIKI_CONTENT_DIR", dir);
  });

  afterEach(async () => {
    vi.unstubAllEnvs();
    await rm(dir, { recursive: true, force: true });
  });

  it("returns no reasons for a well-formed draft", async () => {
    const draft: DocumentDraft = {
      version: "v1",
      slug: "tools",
      frontmatter: { title: "Tools", description: "Built-in tools.", category: "Reference", order: 2 },
      body: "# Tools\n\n## Usage\n\nBody.",
    };
    await expect(canPublish(draft)).resolves.toEqual([]);
  });

  it("returns every failing reason at once, never throwing", async () => {
    const draft: DocumentDraft = {
      version: "v1",
      slug: "broken",
      frontmatter: {
        title: "Broken",
        description: "Broken",
        category: "Reference",
        order: 1,
        deprecated: true,
        replacedBy: "does-not-exist",
      },
      body: "   ",
    };
    const reasons = await canPublish(draft);
    expect(reasons.length).toBeGreaterThanOrEqual(4);
  });

  it("flags a description identical to the title", async () => {
    const draft: DocumentDraft = {
      version: "v1",
      slug: "tools",
      frontmatter: { title: "Tools", description: "Tools", category: "Reference", order: 2 },
      body: "# Tools\n\n## Usage\n\nBody.",
    };
    const reasons = await canPublish(draft);
    expect(reasons.some((r) => r.reason.includes("identical to the title"))).toBe(true);
  });

  it("flags a body with no level-2 heading", async () => {
    const draft: DocumentDraft = {
      version: "v1",
      slug: "tools",
      frontmatter: { title: "Tools", description: "Built-in tools.", category: "Reference", order: 2 },
      body: "# Tools\n\nJust prose, no subheading.",
    };
    const reasons = await canPublish(draft);
    expect(reasons.some((r) => r.reason.includes("level-2"))).toBe(true);
  });
});
