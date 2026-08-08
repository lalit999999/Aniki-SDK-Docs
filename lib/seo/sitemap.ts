/**
 * Sitemap entry builder for `app/sitemap.ts` (D3). The sitemap is always
 * derived from the live content index at build time - `getDocVersions()`,
 * `getAllDocMeta()`, `getAllReleaseMeta()` - never stored, so it can't go
 * stale the way a hand-maintained or cached sitemap would the moment
 * someone edits a file.
 *
 * `import "server-only"` guards this module (and, transitively, anything
 * that re-exports it, including `./index`) the same way
 * `lib/content/index.ts` guards itself: every function here ultimately
 * reads `content/docs` and `content/changelog` from disk.
 */

import "server-only";

import type { MetadataRoute } from "next";

import { seoConfig } from "@/config/seo";
import { getAllReleaseMeta } from "@/lib/changelog";
import { getAllDocMeta, getDocVersions } from "@/lib/content";
import { getLatestVersion } from "@/lib/versions";

import { SitemapBuildError } from "./errors";
import { buildAbsoluteUrl } from "./metadata";

function isoDateFromCalendarDate(date: string): string {
  return `${date}T00:00:00.000Z`;
}

/**
 * Builds every entry in the site's sitemap (D3): the home page, the latest
 * documentation version's index, every visible non-deprecated page in the
 * latest version (T6/T7 - `getAllDocMeta()` already excludes drafts in
 * production and defaults to the latest version), the changelog index, and
 * every release. Entries are deduplicated by URL and asserted to contain no
 * path under `seoConfig.noindexPathPrefixes` (T7/T8): a leak there would
 * mean submitting a noindex URL to search engines, or a duplicate canonical
 * for a page that already has exactly one true URL.
 *
 * @throws {SitemapBuildError} if, after deduplication, an entry's URL still
 * falls under a disallowed path prefix - this indicates a bug in this
 * function itself, not bad content.
 * @throws Same as `getDocVersions`, `getAllDocMeta`, and `getAllReleaseMeta`
 * (a broken version registry or invalid frontmatter fails the build, T1/T2).
 *
 * @example
 * ```ts
 * const entries = await buildSitemapEntries();
 * entries[0].url; // "https://example.com"
 * ```
 */
export async function buildSitemapEntries(): Promise<MetadataRoute.Sitemap> {
  const [versions, docs, releases] = await Promise.all([
    getDocVersions(),
    getAllDocMeta(),
    getAllReleaseMeta(),
  ]);

  const latest = getLatestVersion();
  const latestSummary = versions.find((version) => version.id === latest.id);
  const fallbackLastModified = isoDateFromCalendarDate(latest.releasedAt);
  const docsIndexRoute = latestSummary?.indexRoute ?? "/docs";

  const entries: MetadataRoute.Sitemap = [];

  entries.push({
    url: buildAbsoluteUrl("/"),
    lastModified: fallbackLastModified,
    changeFrequency: "weekly",
    priority: 0.9,
  });

  entries.push({
    url: buildAbsoluteUrl(docsIndexRoute),
    lastModified: fallbackLastModified,
    changeFrequency: "daily",
    priority: 1,
  });

  for (const doc of docs) {
    // The version's own index page is already covered by the docsIndexRoute
    // entry above - including it again would just be the same URL at a
    // lower priority. Deprecated pages are noindex (T7) and must not appear
    // here at all.
    if (doc.slug === "index" || doc.deprecated) {
      continue;
    }
    entries.push({
      url: buildAbsoluteUrl(doc.route),
      lastModified: doc.updatedAt ?? fallbackLastModified,
      changeFrequency: "weekly",
      priority: 0.8,
    });
  }

  const newestRelease = releases[0];
  entries.push({
    url: buildAbsoluteUrl("/changelog"),
    lastModified: newestRelease !== undefined ? isoDateFromCalendarDate(newestRelease.date) : fallbackLastModified,
    changeFrequency: "weekly",
    priority: 0.6,
  });

  for (const release of releases) {
    entries.push({
      url: buildAbsoluteUrl(release.route),
      lastModified: isoDateFromCalendarDate(release.date),
      changeFrequency: "monthly",
      priority: 0.5,
    });
  }

  const seenUrls = new Set<string>();
  const deduped: MetadataRoute.Sitemap = [];
  for (const entry of entries) {
    if (seenUrls.has(entry.url)) {
      continue;
    }
    seenUrls.add(entry.url);
    deduped.push(entry);
  }

  for (const entry of deduped) {
    for (const prefix of seoConfig.noindexPathPrefixes) {
      if (entry.url.startsWith(buildAbsoluteUrl(prefix))) {
        throw new SitemapBuildError(`sitemap entry falls under noindex path prefix "${prefix}"`, {
          url: entry.url,
        });
      }
    }
  }

  return deduped;
}
