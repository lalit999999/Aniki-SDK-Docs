/**
 * Orchestration layer: reads every file in `content/docs`, validates its
 * frontmatter, parses its markdown, and assembles the `Doc` objects the
 * public API in `index.ts` serves.
 *
 * Not exported directly - `index.ts` is the public surface. Importing
 * from this module elsewhere in the app bypasses the `server-only` guard
 * and the documented contract of what's safe to call from where.
 */

import path from "node:path";

import matter from "gray-matter";

import { getLatestVersion } from "@/lib/versions/registry";

import { ContentNotFoundError, DuplicateSlugError } from "./errors";
import { resolveLastModified } from "./git";
import { extractHeadings, extractLeadingH1, parseMarkdown, stripLeadingH1 } from "./headings";
import { listDocFiles, readDocFile } from "./paths";
import { calculateReadingTime } from "./reading-time";
import { parsePartialFrontmatter } from "./schema";
import { fileNameToSlug, slugToRoute, slugToTitle } from "./slug";
import { buildToc } from "./toc";
import { DOC_CATEGORIES } from "./types";
import type { AdjacentDocs, Doc, DocCategory, DocMeta, DocNavCategory } from "./types";

const FALLBACK_CATEGORY: DocCategory = "Reference";

async function buildDoc(filePath: string): Promise<Doc> {
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

  const headings = extractHeadings(tree, { maxLevel: 4 });
  const toc = buildToc(headings);
  const readingTime = calculateReadingTime(tree);
  const { updatedAt, source: updatedSource } = await resolveLastModified(
    filePath,
    frontmatter.updated,
  );

  const meta: DocMeta = {
    slug,
    route: slugToRoute(slug),
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

let cachedIndex: Doc[] | null = null;

async function buildIndex(): Promise<Doc[]> {
  if (process.env.NODE_ENV === "production" && cachedIndex !== null) {
    return cachedIndex;
  }

  const files = await listDocFiles(getLatestVersion().id);
  const docs = await Promise.all(files.map((file) => buildDoc(file)));

  const filePathsBySlug = new Map<string, string[]>();
  for (const doc of docs) {
    const existing = filePathsBySlug.get(doc.meta.slug) ?? [];
    existing.push(doc.meta.filePath);
    filePathsBySlug.set(doc.meta.slug, existing);
  }
  for (const [slug, filePaths] of filePathsBySlug) {
    if (filePaths.length > 1) {
      throw new DuplicateSlugError(`duplicate slug "${slug}"`, { slug, filePaths });
    }
  }

  docs.sort((a, b) => compareDocMeta(a.meta, b.meta));

  if (process.env.NODE_ENV === "production") {
    cachedIndex = docs;
  }

  return docs;
}

/**
 * Clears the production-only content cache. Intended for tests that need
 * each case to see a fresh read of disk.
 *
 * @example
 * ```ts
 * afterEach(() => clearContentCache());
 * ```
 */
export function clearContentCache(): void {
  cachedIndex = null;
}

/**
 * Loads every non-draft document, sorted by category order then
 * `order`. Draft documents are included in development and excluded in
 * production.
 *
 * @throws {ContentDirectoryError} if `content/docs` can't be read.
 * @throws {FrontmatterValidationError} if any file's frontmatter is invalid.
 * @throws {DuplicateSlugError} if two files resolve to the same slug.
 * @throws {MarkdownParseError} if a file's markdown can't be parsed.
 *
 * @example
 * ```ts
 * const docs = await getAllDocs();
 * console.log(docs.length); // 16
 * ```
 */
export async function getAllDocs(): Promise<Doc[]> {
  const docs = await buildIndex();
  return docs.filter(isVisible);
}

/**
 * Loads metadata only for every visible document - cheaper than
 * `getAllDocs` when content isn't needed, e.g. for navigation or a
 * sitemap.
 *
 * @throws Same as {@link getAllDocs}.
 *
 * @example
 * ```ts
 * const meta = await getAllDocMeta();
 * ```
 */
export async function getAllDocMeta(): Promise<DocMeta[]> {
  const docs = await getAllDocs();
  return docs.map((doc) => doc.meta);
}

/**
 * Slugs of every visible document, in navigation order.
 *
 * @throws Same as {@link getAllDocs}.
 */
export async function getDocSlugs(): Promise<string[]> {
  const metas = await getAllDocMeta();
  return metas.map((meta) => meta.slug);
}

/**
 * Routes of every visible document, shaped for use in a
 * `generateStaticParams` implementation in Step 3.
 *
 * @throws Same as {@link getAllDocs}.
 */
export async function getDocRoutes(): Promise<string[]> {
  const metas = await getAllDocMeta();
  return metas.map((meta) => meta.route);
}

/**
 * Loads a single document by slug, regardless of draft status.
 *
 * @throws {ContentNotFoundError} if no file resolves to `slug`. The error
 * lists every known slug so a caller can suggest alternatives.
 *
 * @example
 * ```ts
 * const doc = await getDocBySlug("guides");
 * ```
 */
export async function getDocBySlug(slug: string): Promise<Doc> {
  const docs = await buildIndex();
  const found = docs.find((doc) => doc.meta.slug === slug);
  if (found === undefined) {
    throw new ContentNotFoundError(`no document for slug "${slug}"`, {
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
export async function findDocBySlug(slug: string): Promise<Doc | null> {
  const docs = await buildIndex();
  return docs.find((doc) => doc.meta.slug === slug) ?? null;
}

/**
 * Metadata for every visible document in a given category, in `order`.
 *
 * @throws Same as {@link getAllDocs}.
 *
 * @example
 * ```ts
 * const referenceDocs = await getDocsByCategory("Reference");
 * ```
 */
export async function getDocsByCategory(category: DocCategory): Promise<DocMeta[]> {
  const metas = await getAllDocMeta();
  return metas.filter((meta) => meta.category === category);
}

/**
 * The full sidebar tree: every category in `DOC_CATEGORIES` order, each
 * with its visible documents in `order`.
 *
 * @throws Same as {@link getAllDocs}.
 *
 * @example
 * ```ts
 * const nav = await getDocNavigation();
 * // [{ category: "Getting Started", docs: [...] }, ...]
 * ```
 */
export async function getDocNavigation(): Promise<DocNavCategory[]> {
  const metas = await getAllDocMeta();
  return DOC_CATEGORIES.map((category) => ({
    category,
    docs: metas.filter((meta) => meta.category === category),
  }));
}

/**
 * The documents immediately before and after `slug` in flattened
 * navigation order, crossing category boundaries. Either side is `null`
 * at the start/end of the document set.
 *
 * @throws {ContentNotFoundError} if `slug` isn't a visible document.
 *
 * @example
 * ```ts
 * const { previous, next } = await getAdjacentDocs("tools");
 * ```
 */
export async function getAdjacentDocs(slug: string): Promise<AdjacentDocs> {
  const metas = await getAllDocMeta();
  const index = metas.findIndex((meta) => meta.slug === slug);
  if (index === -1) {
    throw new ContentNotFoundError(`no document for slug "${slug}"`, {
      slug,
      availableSlugs: metas.map((meta) => meta.slug),
    });
  }
  return {
    previous: metas[index - 1] ?? null,
    next: metas[index + 1] ?? null,
  };
}
