/**
 * Orchestration layer: reads every file in a version's content directory,
 * validates its frontmatter, parses its markdown, and assembles the `Doc`
 * objects the public API in `index.ts` serves.
 *
 * Not exported directly - `index.ts` is the public surface. Importing
 * from this module elsewhere in the app bypasses the `server-only` guard
 * and the documented contract of what's safe to call from where.
 *
 * Every function below takes an optional trailing `versionId`, defaulting
 * to the latest version (D8) - existing call sites that never mention
 * versioning keep compiling and behaving exactly as before.
 */

import path from "node:path";

import matter from "gray-matter";

import { VersionConfigError } from "@/lib/versions/errors";
import { getLatestVersion, getVersions, resolveVersionId } from "@/lib/versions/registry";
import type { DocsVersionSummary } from "@/lib/versions/types";

import { assertVersionDirectories, listDocFiles, readDocFile } from "./paths";
import { ContentNotFoundError, DuplicateSlugError, FrontmatterValidationError } from "./errors";
import { resolveLastModified } from "./git";
import { extractHeadings, extractLeadingH1, parseMarkdown, stripLeadingH1 } from "./headings";
import { calculateReadingTime } from "./reading-time";
import { parsePartialFrontmatter } from "./schema";
import { fileNameToSlug, slugToRoute, slugToTitle, slugToVersionedRoute } from "./slug";
import { buildToc } from "./toc";
import { DOC_CATEGORIES } from "./types";
import type { AdjacentDocs, Doc, DocCategory, DocMeta, DocNavCategory } from "./types";

const FALLBACK_CATEGORY: DocCategory = "Reference";

async function buildDoc(filePath: string, versionId: string): Promise<Doc> {
  const raw = await readDocFile(filePath);
  const parsed = matter(raw);
  const frontmatter = parsePartialFrontmatter(parsed.data, filePath);

  const fileName = path.basename(filePath);
  const slug = fileNameToSlug(fileName, filePath);

  const tree = parseMarkdown(parsed.content, filePath);
  const leadingH1 = extractLeadingH1(tree);

  const title = frontmatter.title ?? leadingH1 ?? slugToTitle(slug);
  const description = frontmatter.description ?? title;
  const category = frontmatter.category ?? FALLBACK_CATEGORY;
  const order = frontmatter.order ?? 0;
  const draft = frontmatter.draft ?? false;
  const tags = frontmatter.tags ?? [];
  const deprecated = frontmatter.deprecated ?? false;
  const deprecatedSince = frontmatter.deprecatedSince ?? null;
  const deprecatedReason = frontmatter.deprecatedReason ?? null;
  const replacedBy = frontmatter.replacedBy ?? null;
  const since = frontmatter.since ?? null;

  const headings = extractHeadings(tree, { maxLevel: 4 });
  const toc = buildToc(headings);
  const readingTime = calculateReadingTime(tree);
  const { updatedAt, source: updatedSource } = await resolveLastModified(
    filePath,
    frontmatter.updated,
  );

  const meta: DocMeta = {
    slug,
    route: slugToRoute(slug, versionId),
    versionedRoute: slugToVersionedRoute(slug, versionId),
    filePath: path.relative(process.cwd(), filePath),
    title,
    description,
    category,
    order,
    tags,
    draft,
    updatedAt,
    updatedSource,
    readingTime,
    version: versionId,
    isLatestVersion: versionId === getLatestVersion().id,
    deprecated,
    deprecatedSince,
    deprecatedReason,
    replacedBy,
    since,
  };

  return {
    meta,
    content: stripLeadingH1(parsed.content),
    rawContent: parsed.content,
    headings,
    toc,
  };
}

function compareDocMeta(a: DocMeta, b: DocMeta): number {
  const categoryDiff = DOC_CATEGORIES.indexOf(a.category) - DOC_CATEGORIES.indexOf(b.category);
  if (categoryDiff !== 0) {
    return categoryDiff;
  }
  return a.order - b.order;
}

function isVisible(doc: Doc): boolean {
  return !doc.meta.draft || process.env.NODE_ENV !== "production";
}

const cachedIndexes = new Map<string, Doc[]>();

async function buildIndex(versionId?: string): Promise<Doc[]> {
  const resolvedVersionId = resolveVersionId(versionId);

  if (process.env.NODE_ENV === "production" && cachedIndexes.has(resolvedVersionId)) {
    return cachedIndexes.get(resolvedVersionId) as Doc[];
  }

  const files = await listDocFiles(resolvedVersionId);
  const docs = await Promise.all(files.map((file) => buildDoc(file, resolvedVersionId)));

  const filePathsBySlug = new Map<string, string[]>();
  for (const doc of docs) {
    const existing = filePathsBySlug.get(doc.meta.slug) ?? [];
    existing.push(doc.meta.filePath);
    filePathsBySlug.set(doc.meta.slug, existing);
  }
  for (const [slug, filePaths] of filePathsBySlug) {
    if (filePaths.length > 1) {
      throw new DuplicateSlugError(`duplicate slug "${slug}" in version "${resolvedVersionId}"`, {
        slug,
        filePaths,
      });
    }
  }

  const slugSet = new Set(docs.map((doc) => doc.meta.slug));
  const danglingReplacedBy = docs
    .filter((doc) => doc.meta.replacedBy !== null && !slugSet.has(doc.meta.replacedBy))
    .map((doc) => `"${doc.meta.filePath}" declares replacedBy: "${doc.meta.replacedBy}", which has no matching page in version "${resolvedVersionId}"`);
  if (danglingReplacedBy.length > 0) {
    throw new FrontmatterValidationError(
      `dangling replacedBy pointer(s) in version "${resolvedVersionId}":\n${danglingReplacedBy.join("\n")}`,
      { filePath: resolvedVersionId, issues: danglingReplacedBy },
    );
  }

  docs.sort((a, b) => compareDocMeta(a.meta, b.meta));

  if (process.env.NODE_ENV === "production") {
    cachedIndexes.set(resolvedVersionId, docs);
  }

  return docs;
}

/**
 * Clears the production-only content cache for every version. Intended for
 * tests that need each case to see a fresh read of disk.
 *
 * @example
 * ```ts
 * afterEach(() => clearContentCache());
 * ```
 */
export function clearContentCache(): void {
  cachedIndexes.clear();
}

/**
 * Loads every non-draft document in a version, sorted by category order
 * then `order`. Draft documents are included in development and excluded
 * in production. Omitting `versionId` resolves the latest version.
 *
 * @throws {ContentDirectoryError} if the version's directory can't be read.
 * @throws {FrontmatterValidationError} if any file's frontmatter is invalid.
 * @throws {DuplicateSlugError} if two files in the version resolve to the
 * same slug.
 * @throws {MarkdownParseError} if a file's markdown can't be parsed.
 * @throws {UnknownVersionError} if `versionId` is given but not declared.
 *
 * @example
 * ```ts
 * const docs = await getAllDocs();
 * console.log(docs.length); // 16
 * ```
 */
export async function getAllDocs(versionId?: string): Promise<Doc[]> {
  const docs = await buildIndex(versionId);
  return docs.filter(isVisible);
}

/**
 * Loads metadata only for every visible document in a version - cheaper
 * than `getAllDocs` when content isn't needed, e.g. for navigation or a
 * sitemap.
 *
 * @throws Same as {@link getAllDocs}.
 *
 * @example
 * ```ts
 * const meta = await getAllDocMeta();
 * ```
 */
export async function getAllDocMeta(versionId?: string): Promise<DocMeta[]> {
  const docs = await getAllDocs(versionId);
  return docs.map((doc) => doc.meta);
}

/**
 * Slugs of every visible document in a version, in navigation order.
 *
 * @throws Same as {@link getAllDocs}.
 */
export async function getDocSlugs(versionId?: string): Promise<string[]> {
  const metas = await getAllDocMeta(versionId);
  return metas.map((meta) => meta.slug);
}

/**
 * Routes of every visible document in a version.
 *
 * @throws Same as {@link getAllDocs}.
 */
export async function getDocRoutes(versionId?: string): Promise<string[]> {
  const metas = await getAllDocMeta(versionId);
  return metas.map((meta) => meta.route);
}

/**
 * Loads a single document by slug within a version, regardless of draft
 * status.
 *
 * @throws {ContentNotFoundError} if no file in the version resolves to
 * `slug`. The error lists every known slug in that version so a caller can
 * suggest alternatives.
 *
 * @example
 * ```ts
 * const doc = await getDocBySlug("guides");
 * const v1Doc = await getDocBySlug("guides", "v1");
 * ```
 */
export async function getDocBySlug(slug: string, versionId?: string): Promise<Doc> {
  const resolvedVersionId = resolveVersionId(versionId);
  const docs = await buildIndex(resolvedVersionId);
  const found = docs.find((doc) => doc.meta.slug === slug);
  if (found === undefined) {
    throw new ContentNotFoundError(`no document for slug "${slug}" in version "${resolvedVersionId}"`, {
      slug,
      availableSlugs: docs.map((doc) => doc.meta.slug),
    });
  }
  return found;
}

/**
 * Non-throwing variant of {@link getDocBySlug}, for call sites that want
 * to invoke Next's `notFound()` rather than catch an error.
 *
 * @example
 * ```ts
 * const doc = await findDocBySlug(slug);
 * if (doc === null) notFound();
 * ```
 */
export async function findDocBySlug(slug: string, versionId?: string): Promise<Doc | null> {
  const docs = await buildIndex(versionId);
  return docs.find((doc) => doc.meta.slug === slug) ?? null;
}

/**
 * Metadata for every visible document in a category, within a version, in
 * `order`.
 *
 * @throws Same as {@link getAllDocs}.
 *
 * @example
 * ```ts
 * const referenceDocs = await getDocsByCategory("Reference");
 * ```
 */
export async function getDocsByCategory(category: DocCategory, versionId?: string): Promise<DocMeta[]> {
  const metas = await getAllDocMeta(versionId);
  return metas.filter((meta) => meta.category === category);
}

/**
 * The full sidebar tree for a version: every category in `DOC_CATEGORIES`
 * order, each with its visible documents in `order`.
 *
 * @throws Same as {@link getAllDocs}.
 *
 * @example
 * ```ts
 * const nav = await getDocNavigation();
 * // [{ category: "Getting Started", docs: [...] }, ...]
 * ```
 */
export async function getDocNavigation(versionId?: string): Promise<DocNavCategory[]> {
  const metas = await getAllDocMeta(versionId);
  return DOC_CATEGORIES.map((category) => ({
    category,
    docs: metas.filter((meta) => meta.category === category),
  }));
}

/**
 * The documents immediately before and after `slug` in a version's
 * flattened navigation order, crossing category boundaries. Either side is
 * `null` at the start/end of that version's document set.
 *
 * @throws {ContentNotFoundError} if `slug` isn't a visible document in the
 * version.
 *
 * @example
 * ```ts
 * const { previous, next } = await getAdjacentDocs("tools");
 * ```
 */
export async function getAdjacentDocs(slug: string, versionId?: string): Promise<AdjacentDocs> {
  const resolvedVersionId = resolveVersionId(versionId);
  const metas = await getAllDocMeta(resolvedVersionId);
  const index = metas.findIndex((meta) => meta.slug === slug);
  if (index === -1) {
    throw new ContentNotFoundError(`no document for slug "${slug}" in version "${resolvedVersionId}"`, {
      slug,
      availableSlugs: metas.map((meta) => meta.slug),
    });
  }
  return {
    previous: metas[index - 1] ?? null,
    next: metas[index + 1] ?? null,
  };
}

/**
 * Summarizes every declared documentation version with its live document
 * count and index route, after validating that the registry and the
 * on-disk content directories agree (D3).
 *
 * @throws {VersionConfigError} if a declared version has no directory, a
 * directory has no declared version, or a version's `migrationGuideSlug`
 * doesn't resolve to a real page in that version.
 *
 * @example
 * ```ts
 * const versions = await getDocVersions();
 * // [{ id: "v1", label: "v1.0", status: "latest", docCount: 16, indexRoute: "/docs", ... }]
 * ```
 */
export async function getDocVersions(): Promise<DocsVersionSummary[]> {
  await assertVersionDirectories();

  const versions = getVersions();
  const summaries = await Promise.all(
    versions.map(async (version): Promise<DocsVersionSummary> => {
      const docs = await getAllDocs(version.id);
      return {
        ...version,
        docCount: docs.length,
        indexRoute: slugToRoute("index", version.id),
      };
    }),
  );

  // Re-fetches each version's docs (cheap: warm from the summary pass
  // above via buildIndex's cache) purely to check migrationGuideSlug,
  // since that value lives on the registry entry, not on any one doc.
  await Promise.all(
    summaries
      .filter((version) => version.migrationGuideSlug !== undefined)
      .map(async (version) => {
        const docs = await getAllDocs(version.id);
        const hasGuide = docs.some((doc) => doc.meta.slug === version.migrationGuideSlug);
        if (!hasGuide) {
          const violation = `version "${version.id}" declares migrationGuideSlug "${version.migrationGuideSlug}", which has no matching page`;
          throw new VersionConfigError(violation, { violations: [violation] });
        }
      }),
  );

  return summaries;
}

/**
 * Every page in every documentation version, shaped for
 * `generateStaticParams` on the `[...slug]` catch-all route (D5/D6). The
 * latest version's pages are emitted with unprefixed segments (`[]` for
 * its index, `[slug]` for a page); every other version's pages are emitted
 * with a leading version segment (`[versionId]`, `[versionId, slug]`) -
 * the latest version's *prefixed* aliases are handled by redirects in
 * `next.config.ts` instead of being emitted here, so there is exactly one
 * static path per page (D6).
 *
 * @throws Same as {@link getAllDocs}, for any version.
 *
 * @example
 * ```ts
 * const routes = await getAllVersionedRoutes();
 * // [{ versionId: "v1", slug: "index", segments: [] },
 * //  { versionId: "v1", slug: "tools", segments: ["tools"] }]
 * ```
 */
export async function getAllVersionedRoutes(): Promise<
  { versionId: string; slug: string; segments: string[] }[]
> {
  const latestId = getLatestVersion().id;
  const versions = getVersions();

  const perVersion = await Promise.all(
    versions.map(async (version) => {
      const metas = await getAllDocMeta(version.id);
      return metas.map((meta) => {
        const isLatest = version.id === latestId;
        const segments =
          meta.slug === "index"
            ? isLatest
              ? []
              : [version.id]
            : isLatest
              ? [meta.slug]
              : [version.id, meta.slug];
        return { versionId: version.id, slug: meta.slug, segments };
      });
    }),
  );

  return perVersion.flat();
}
