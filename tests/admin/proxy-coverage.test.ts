import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Reads proxy.ts's own source rather than importing it: the file's other
 * exports pull in `next/server`, which assumes a Next.js request
 * lifecycle this plain Vitest environment doesn't provide. The invariant
 * this file checks - matcher coverage and force-dynamic - is entirely a
 * static property of source text, so it never needs to actually execute
 * proxy.ts, `app/admin/**\/page.tsx`, or `app/api/admin/**\/route.ts`.
 */

const REPO_ROOT = process.cwd();

async function findFilesNamed(startDir: string, fileName: string): Promise<string[]> {
  const results: string[] = [];

  async function recurse(dir: string): Promise<void> {
    const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await recurse(fullPath);
      } else if (entry.name === fileName) {
        results.push(fullPath);
      }
    }
  }

  await recurse(startDir);
  return results;
}

function toRoutePath(filePath: string, searchRoot: string, routePrefix: string): string {
  const relative = path.relative(searchRoot, path.dirname(filePath)).split(path.sep).join("/");
  return relative === "" ? routePrefix : `${routePrefix}/${relative}`;
}

/**
 * Whether a Next.js matcher pattern covers `pathname`. Only supports the
 * one dynamic shape this project's matcher actually uses - a literal
 * prefix followed by a `:name*` catch-all segment (e.g. `/admin/:path*`
 * covers `/admin` and everything nested under it) - since that's the only
 * shape there is anything to validate against.
 */
function matcherCoversPath(matcherPattern: string, pathname: string): boolean {
  const catchAll = matcherPattern.match(/^(.*)\/:[A-Za-z0-9_]+\*$/);
  if (catchAll === null) {
    return matcherPattern === pathname;
  }
  const prefix = catchAll[1] ?? "";
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

async function extractMatcherPatterns(): Promise<string[]> {
  const source = await readFile(path.join(REPO_ROOT, "proxy.ts"), "utf-8");
  const matcherBlock = source.match(/matcher\s*:\s*\[([^\]]*)\]/);
  if (matcherBlock === null) {
    throw new Error("proxy.ts must export a config.matcher array");
  }
  const patterns = [...matcherBlock[1].matchAll(/["']([^"']+)["']/g)].map((m) => m[1]);
  if (patterns.length === 0) {
    throw new Error("proxy.ts's config.matcher array must not be empty");
  }
  return patterns;
}

describe("admin route coverage (generic against the filesystem)", () => {
  it("proxy.ts's matcher covers every app/admin page and app/api/admin route", async () => {
    const patterns = await extractMatcherPatterns();

    const pageSearchRoot = path.join(REPO_ROOT, "app", "admin");
    const routeSearchRoot = path.join(REPO_ROOT, "app", "api", "admin");

    const pagePaths = (await findFilesNamed(pageSearchRoot, "page.tsx")).map((file) =>
      toRoutePath(file, pageSearchRoot, "/admin"),
    );
    const routePaths = (await findFilesNamed(routeSearchRoot, "route.ts")).map((file) =>
      toRoutePath(file, routeSearchRoot, "/api/admin"),
    );

    for (const pathname of pagePaths) {
      const covered = patterns.some((pattern) => matcherCoversPath(pattern, pathname));
      expect(covered, `no matcher pattern in proxy.ts covers admin page route "${pathname}"`).toBe(true);
    }

    for (const pathname of routePaths) {
      const covered = patterns.some((pattern) => matcherCoversPath(pattern, pathname));
      expect(covered, `no matcher pattern in proxy.ts covers admin API route "${pathname}"`).toBe(true);
    }
  });

  it("every app/admin page and app/api/admin route opts into force-dynamic", async () => {
    const pageFiles = await findFilesNamed(path.join(REPO_ROOT, "app", "admin"), "page.tsx");
    const routeFiles = await findFilesNamed(path.join(REPO_ROOT, "app", "api", "admin"), "route.ts");
    const dynamicExport = /export\s+const\s+dynamic\s*=\s*["']force-dynamic["']/;

    for (const file of [...pageFiles, ...routeFiles]) {
      const source = await readFile(file, "utf-8");
      expect(dynamicExport.test(source), `${file} must export \`const dynamic = "force-dynamic"\``).toBe(true);
    }
  });

  it("sanity check: the matcher-coverage helper actually rejects an uncovered path", () => {
    expect(matcherCoversPath("/admin/:path*", "/docs")).toBe(false);
    expect(matcherCoversPath("/admin/:path*", "/admin")).toBe(true);
    expect(matcherCoversPath("/admin/:path*", "/admin/content/v1")).toBe(true);
    expect(matcherCoversPath("/api/admin/:path*", "/api/search-index")).toBe(false);
  });
});
