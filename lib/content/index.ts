/**
 * Public entry point for the markdown content system - the Content
 * Loader API.
 *
 * This is the only module of `lib/content` anything outside this
 * directory should import from. `import "server-only"` turns an
 * accidental import into a Client Component into a build-time error
 * instead of a confusing runtime `fs` bundling failure, since every
 * function here ultimately reads from disk via `node:fs/promises`.
 *
 * @example
 * ```ts
 * import { getAllDocMeta, getDocBySlug } from "@/lib/content";
 *
 * const meta = await getAllDocMeta();
 * const doc = await getDocBySlug("introduction");
 * ```
 */

import "server-only";

export {
  clearContentCache,
  findDocBySlug,
  getAdjacentDocs,
  getAllDocMeta,
  getAllDocs,
  getDocBySlug,
  getDocNavigation,
  getDocRoutes,
  getDocSlugs,
  getDocsByCategory,
} from "./loader";

export {
  ContentDirectoryError,
  ContentError,
  ContentNotFoundError,
  DuplicateSlugError,
  FrontmatterValidationError,
  MarkdownParseError,
  ReservedSlugError,
} from "./errors";
export type { ContentErrorCode } from "./errors";

export { docFrontmatterSchema, parseFrontmatter, parsePartialFrontmatter, partialDocFrontmatterSchema } from "./schema";

export { createHeadingSlugger, fileNameToSlug, slugToRoute, slugToVersionedRoute, slugToTitle } from "./slug";
export type { HeadingSlugger } from "./slug";

export { extractHeadings, extractLeadingH1, parseMarkdown, stripLeadingH1 } from "./headings";
export { buildToc, flattenToc } from "./toc";
export { calculateReadingTime, extractProse } from "./reading-time";
export { getGitLastModified, resolveLastModified } from "./git";
export {
  assertVersionDirectories,
  getContentDirectory,
  getContentRoot,
  listDocFiles,
  listVersionDirectories,
  readDocFile,
} from "./paths";

export { DOC_CATEGORIES } from "./types";
export type {
  AdjacentDocs,
  Doc,
  DocCategory,
  DocFrontmatter,
  DocHeading,
  DocMeta,
  DocNavCategory,
  DocReadingTime,
  TocNode,
  UpdatedSource,
} from "./types";
