/**
 * Orchestration layer: reads every file in `content/changelog`, validates
 * its frontmatter, parses its markdown, and assembles the `Release`
 * objects the public API in `index.ts` serves. Mirrors
 * `lib/content/loader.ts`'s shape - not exported directly, `index.ts` is
 * the public surface.
 */

import path from "node:path";

import matter from "gray-matter";

import { extractHeadings, parseMarkdown } from "@/lib/content/headings";
import { buildToc } from "@/lib/content/toc";
import { isKnownVersionId } from "@/lib/versions/registry";

import { DuplicateReleaseError, ReleaseFrontmatterInvalidError, ReleaseNotFoundError } from "./errors";
import { listReleaseFiles, readReleaseFile } from "./paths";
import { parseReleaseFrontmatter } from "./schema";
import { compareSemver } from "./semver";
import type { AdjacentReleases, Release, ReleaseMeta } from "./types";

function slugForVersion(version: string): string {
  return `v${version}`;
}

async function buildRelease(filePath: string): Promise<Release> {
  const raw = await readReleaseFile(filePath);
  const parsed = matter(raw);
  const frontmatter = parseReleaseFrontmatter(parsed.data, filePath);

  if (!isKnownVersionId(frontmatter.docsVersion)) {
    throw new ReleaseFrontmatterInvalidError(
      `invalid release frontmatter in ${filePath}:\ndocsVersion: "${frontmatter.docsVersion}" is not a declared documentation version`,
      { filePath, issues: [`docsVersion: "${frontmatter.docsVersion}" is not a declared documentation version`] },
    );
  }

  const slug = slugForVersion(frontmatter.version);
  const tree = parseMarkdown(parsed.content, filePath);
  const headings = extractHeadings(tree);
  const toc = buildToc(headings);

  const meta: ReleaseMeta = {
    ...frontmatter,
    slug,
    route: `/changelog/${slug}`,
    filePath: path.relative(process.cwd(), filePath),
  };

  return { meta, content: parsed.content, headings, toc };
}

function compareReleaseMeta(a: ReleaseMeta, b: ReleaseMeta): number {
  if (a.date !== b.date) {
    return a.date < b.date ? 1 : -1;
  }
  return -compareSemver(a.version, b.version);
}

let cachedReleases: Release[] | null = null;

async function buildIndex(): Promise<Release[]> {
  if (process.env.NODE_ENV === "production" && cachedReleases !== null) {
    return cachedReleases;
  }

  const files = await listReleaseFiles();
  const releases = await Promise.all(files.map((file) => buildRelease(file)));

  const filePathsByVersion = new Map<string, string[]>();
  for (const release of releases) {
    const existing = filePathsByVersion.get(release.meta.version) ?? [];
    existing.push(release.meta.filePath);
    filePathsByVersion.set(release.meta.version, existing);
  }
  for (const [version, filePaths] of filePathsByVersion) {
    if (filePaths.length > 1) {
      throw new DuplicateReleaseError(`duplicate release version "${version}"`, { version, filePaths });
    }
  }

  releases.sort((a, b) => compareReleaseMeta(a.meta, b.meta));

  if (process.env.NODE_ENV === "production") {
    cachedReleases = releases;
  }

  return releases;
}

/**
 * Clears the production-only changelog cache. Intended for tests that need
 * each case to see a fresh read of disk.
 */
export function clearChangelogCache(): void {
  cachedReleases = null;
}

/**
 * Loads every release, sorted newest-first by `date`, ties broken by
 * descending semantic version (D11).
 *
 * @throws {ChangelogDirectoryError} if `content/changelog` can't be read.
 * @throws {ReleaseFrontmatterInvalidError} if any file's frontmatter is
 * invalid, including an unrecognized `docsVersion`.
 * @throws {DuplicateReleaseError} if two files declare the same version.
 *
 * @example
 * ```ts
 * const releases = await getAllReleases();
 * ```
 */
export async function getAllReleases(): Promise<Release[]> {
  return buildIndex();
}

/**
 * Metadata for every release, in the same order as {@link getAllReleases}.
 *
 * @throws Same as {@link getAllReleases}.
 */
export async function getAllReleaseMeta(): Promise<ReleaseMeta[]> {
  const releases = await getAllReleases();
  return releases.map((release) => release.meta);
}

/**
 * Slugs of every release, in newest-first order.
 *
 * @throws Same as {@link getAllReleases}.
 */
export async function getReleaseSlugs(): Promise<string[]> {
  const metas = await getAllReleaseMeta();
  return metas.map((meta) => meta.slug);
}

/**
 * Loads a single release by slug.
 *
 * @throws {ReleaseNotFoundError} if no release has this slug.
 *
 * @example
 * ```ts
 * const release = await getReleaseBySlug("v1.0.0");
 * ```
 */
export async function getReleaseBySlug(slug: string): Promise<Release> {
  const releases = await buildIndex();
  const found = releases.find((release) => release.meta.slug === slug);
  if (found === undefined) {
    throw new ReleaseNotFoundError(`no release for slug "${slug}"`, {
      slug,
      availableSlugs: releases.map((release) => release.meta.slug),
    });
  }
  return found;
}

/**
 * Non-throwing variant of {@link getReleaseBySlug}.
 *
 * @example
 * ```ts
 * const release = await findReleaseBySlug(slug);
 * if (release === null) notFound();
 * ```
 */
export async function findReleaseBySlug(slug: string): Promise<Release | null> {
  const releases = await buildIndex();
  return releases.find((release) => release.meta.slug === slug) ?? null;
}

/**
 * The releases immediately before and after `slug` in newest-first order.
 * Either side is `null` at the start/end of the release history.
 *
 * @throws {ReleaseNotFoundError} if `slug` doesn't match a release.
 *
 * @example
 * ```ts
 * const { previous, next } = await getAdjacentReleases("v1.0.0");
 * ```
 */
export async function getAdjacentReleases(slug: string): Promise<AdjacentReleases> {
  const metas = await getAllReleaseMeta();
  const index = metas.findIndex((meta) => meta.slug === slug);
  if (index === -1) {
    throw new ReleaseNotFoundError(`no release for slug "${slug}"`, {
      slug,
      availableSlugs: metas.map((meta) => meta.slug),
    });
  }
  return {
    previous: metas[index + 1] ?? null,
    next: metas[index - 1] ?? null,
  };
}
