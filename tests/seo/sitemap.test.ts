/**
 * Exercises `buildSitemapEntries` against a dedicated two-version fixture
 * tree (`tests/seo/fixtures/content`, distinct from
 * `tests/fixtures/content` so this branch never touches a directory shared
 * with the other two parallel prompts) with a draft and a deprecated page
 * mixed in, the same way `tests/content/versions.test.ts` mocks the
 * registry to exercise multi-version behaviour against a fixture rather
 * than the real single-version `content/docs`.
 */
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { siteConfig } from "@/config/site";
import { buildRobotsRules } from "@/lib/seo/robots";

const FIXTURE_ROOT = path.join(process.cwd(), "tests", "seo", "fixtures", "content");

const FIXTURE_VERSIONS = [
  { id: "v2", label: "v2.0", status: "latest" as const, releasedAt: "2026-02-01" },
  { id: "v1", label: "v1.0", status: "maintenance" as const, releasedAt: "2026-01-01" },
];

describe("buildSitemapEntries", () => {
  beforeEach(() => {
    vi.stubEnv("ANIKI_CONTENT_DIR", FIXTURE_ROOT);
    vi.resetModules();
    vi.doMock("@/config/versions", () => ({ DOCS_VERSIONS: FIXTURE_VERSIONS }));
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.doUnmock("@/config/versions");
    vi.resetModules();
  });

  it("includes the home page and the latest version's docs index", async () => {
    const { buildSitemapEntries } = await import("@/lib/seo/sitemap");
    const entries = await buildSitemapEntries();

    const urls = entries.map((entry) => entry.url);
    expect(urls).toContain(siteConfig.url.replace(/\/+$/, ""));
    expect(urls).toContain(`${siteConfig.url}/docs`);
  });

  it("includes a visible latest-version page", async () => {
    const { buildSitemapEntries } = await import("@/lib/seo/sitemap");
    const entries = await buildSitemapEntries();

    expect(entries.map((entry) => entry.url)).toContain(`${siteConfig.url}/docs/tools`);
  });

  it("never includes a page from a non-latest version", async () => {
    const { buildSitemapEntries } = await import("@/lib/seo/sitemap");
    const entries = await buildSitemapEntries();

    expect(entries.some((entry) => entry.url.includes("/docs/v1"))).toBe(false);
    expect(entries.some((entry) => entry.url.includes("legacy-page"))).toBe(false);
  });

  it("never includes a deprecated page", async () => {
    const { buildSitemapEntries } = await import("@/lib/seo/sitemap");
    const entries = await buildSitemapEntries();

    expect(entries.some((entry) => entry.url.includes("deprecated-page"))).toBe(false);
  });

  it("excludes a draft page when NODE_ENV is production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const { buildSitemapEntries } = await import("@/lib/seo/sitemap");
    const entries = await buildSitemapEntries();

    expect(entries.some((entry) => entry.url.includes("draft-page"))).toBe(false);
  });

  it("includes the changelog index and every release", async () => {
    const { buildSitemapEntries } = await import("@/lib/seo/sitemap");
    const entries = await buildSitemapEntries();

    const urls = entries.map((entry) => entry.url);
    expect(urls).toContain(`${siteConfig.url}/changelog`);
    expect(urls).toContain(`${siteConfig.url}/changelog/v1.0.0`);
  });

  it("produces only absolute, unique URLs", async () => {
    const { buildSitemapEntries } = await import("@/lib/seo/sitemap");
    const entries = await buildSitemapEntries();

    const urls = entries.map((entry) => entry.url);
    expect(urls.every((url) => url.startsWith("http"))).toBe(true);
    expect(new Set(urls).size).toBe(urls.length);
  });

  it("never includes an /admin path", async () => {
    const { buildSitemapEntries } = await import("@/lib/seo/sitemap");
    const entries = await buildSitemapEntries();

    expect(entries.some((entry) => entry.url.includes("/admin"))).toBe(false);
  });
});

describe("buildRobotsRules", () => {
  it("disallows /admin and /api/ and links the sitemap", () => {
    const robots = buildRobotsRules();
    const rules = Array.isArray(robots.rules) ? robots.rules[0] : robots.rules;

    expect(rules?.disallow).toContain("/admin");
    expect(rules?.disallow).toContain("/api/");
    expect(rules?.allow).toBe("/");
    expect(robots.sitemap).toBe(`${siteConfig.url}/sitemap.xml`);
  });
});
