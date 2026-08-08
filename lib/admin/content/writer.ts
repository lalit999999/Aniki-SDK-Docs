/**
 * Atomic document writer: the only place in this branch that touches
 * `content/docs` on disk. Every write is validated first (D5 - both against
 * the strict frontmatter schema and against the current on-disk set's index
 * invariants), then written via a temp-file-plus-rename so a crash mid-write
 * never leaves a half-written `.md` file for `next build` to trip over (D4).
 *
 * This module is deliberately free of `next/cache` - `clearContentCache()`
 * (T6) is called after every successful mutation, but the route-level
 * `revalidatePath()` calls belong in the API handlers (sub-task 6), not
 * here, so this stays plain, unit-testable Node code.
 */

import { randomBytes } from "node:crypto";
import { open, rename, unlink } from "node:fs/promises";
import path from "node:path";

import { z } from "zod";

import {
  ContentNotFoundError,
  clearContentCache,
  docFrontmatterSchema,
  fileNameToSlug,
  listDocFiles,
  readDocFile,
} from "@/lib/content";
import type { DocFrontmatter } from "@/lib/content";

import {
  DocumentExistsError,
  DocumentWriteError,
  IndexIntegrityError,
  InvalidDocumentInputError,
  UnsupportedVersionError,
} from "./errors";
import { parseDocumentFile, serializeDocument } from "./frontmatter";
import {
  assertKnownVersion,
  documentExists,
  resolveDocumentPath,
  slugToFileName,
  validateSlugInput,
} from "./paths";
import type { DocumentDraft, ValidationReport, WriteResult } from "./types";

/** A document as it actually exists on disk: parsed frontmatter, body, and
 * the file path it was read from - what `listStoredDocuments` and
 * `readStoredDocument` return, and what `validateDocument`'s index-level
 * checks run against. */
export interface StoredDocument {
  readonly version: string;
  readonly slug: string;
  readonly frontmatter: DocFrontmatter;
  readonly body: string;
  readonly filePath: string;
}

function formatFrontmatterIssues(error: z.ZodError): string[] {
  return error.issues.map((issue) => {
    const issuePath = issue.path.length > 0 ? issue.path.join(".") : "(root)";
    return `${issuePath}: ${issue.message}`;
  });
}

/**
 * Reads and strictly parses every document in a version's directory,
 * regardless of draft status (T6's trap: `getAllDocs` hides drafts in
 * production, which is exactly the wrong thing for an authoring surface
 * that must show and check against every page that exists).
 *
 * @throws {UnsupportedVersionError} if `versionId` isn't declared.
 *
 * @example
 * ```ts
 * const docs = await listStoredDocuments("v1");
 * ```
 */
export async function listStoredDocuments(versionId: string): Promise<StoredDocument[]> {
  assertKnownVersion(versionId);

  const files = await listDocFiles(versionId);
  const docs: StoredDocument[] = [];
  for (const filePath of files) {
    const source = await readDocFile(filePath);
    const fileName = path.basename(filePath);
    const slug = fileNameToSlug(fileName, filePath);
    const { frontmatter, body } = parseDocumentFile(source, filePath);
    docs.push({ version: versionId, slug, frontmatter, body, filePath });
  }
  return docs;
}

/**
 * Reads a single document by version and slug, or `null` if no file backs
 * it - the read path the editor page (sub-task 8) calls before rendering,
 * so it can `notFound()` cleanly on an unknown slug instead of throwing.
 *
 * @throws {UnsupportedVersionError} if `versionId` isn't declared.
 * @throws {InvalidDocumentInputError} if `slug` is malformed.
 *
 * @example
 * ```ts
 * const doc = await readStoredDocument("v1", "tools");
 * if (doc === null) notFound();
 * ```
 */
export async function readStoredDocument(versionId: string, slug: string): Promise<StoredDocument | null> {
  const filePath = resolveDocumentPath(versionId, slug);
  if (!(await documentExists(versionId, slug))) {
    return null;
  }
  const source = await readDocFile(filePath);
  const { frontmatter, body } = parseDocumentFile(source, filePath);
  return { version: versionId, slug, frontmatter, body, filePath };
}

/**
 * Validates a draft before it ever touches disk (D5): the strict frontmatter
 * schema (T7), the slug rules (T1), and the index-level invariants that
 * would otherwise fail `buildIndex` at build time - a duplicate slug (T2,
 * including the `readme.md`/`README.md`/`index.md` collapse) and a dangling
 * `replacedBy` pointer (T3). Every violation is aggregated; this never
 * throws on its own and never stops at the first problem.
 *
 * @example
 * ```ts
 * const report = await validateDocument(draft);
 * if (!report.valid) {
 *   // report.issues: every problem found, field-level and index-level
 * }
 * ```
 */
export async function validateDocument(draft: DocumentDraft): Promise<ValidationReport> {
  const issues: string[] = [];

  let versionKnown = true;
  try {
    assertKnownVersion(draft.version);
  } catch (error) {
    versionKnown = false;
    if (error instanceof UnsupportedVersionError) {
      issues.push(error.message);
    } else {
      throw error;
    }
  }

  try {
    validateSlugInput(draft.slug);
  } catch (error) {
    if (error instanceof InvalidDocumentInputError) {
      issues.push(...(error.context.issues as readonly string[]));
    } else {
      throw error;
    }
  }

  const frontmatterResult = docFrontmatterSchema.safeParse(draft.frontmatter);
  if (!frontmatterResult.success) {
    issues.push(...formatFrontmatterIssues(frontmatterResult.error));
  }

  if (versionKnown) {
    const existing = await listStoredDocuments(draft.version);
    const targetFileName = slugToFileName(draft.slug);

    for (const doc of existing) {
      if (doc.slug === draft.slug && path.basename(doc.filePath) !== targetFileName) {
        issues.push(`slug "${draft.slug}" already resolves to "${doc.filePath}"`);
      }
    }

    if (frontmatterResult.success && frontmatterResult.data.replacedBy !== undefined) {
      const target = frontmatterResult.data.replacedBy;
      const targetExists = existing.some((doc) => doc.slug === target);
      if (!targetExists) {
        issues.push(
          `replacedBy "${target}" does not match any existing page in version "${draft.version}"`,
        );
      }
    }
  }

  return { valid: issues.length === 0, issues };
}

/**
 * Writes `contents` to `filePath` atomically: a temp file in the same
 * directory, `fsync`ed, then renamed into place (D4). `rename` within a
 * directory is atomic on POSIX, so a crash between the temp write and the
 * rename leaves the original file - if any - completely untouched. The temp
 * file is always cleaned up in a `finally`, whether the write succeeded or
 * failed (a successful `rename` already removed it, so that unlink attempt
 * is a harmless no-op).
 *
 * @throws {DocumentWriteError} if opening, writing, syncing, or renaming
 * the temp file fails at any step.
 */
async function writeDocumentAtomically(filePath: string, contents: string): Promise<void> {
  const directory = path.dirname(filePath);
  const tmpName = `.${path.basename(filePath)}.${process.pid}.${randomBytes(4).toString("hex")}.tmp`;
  const tmpPath = path.join(directory, tmpName);

  try {
    const handle = await open(tmpPath, "w");
    try {
      await handle.writeFile(contents, "utf-8");
      await handle.sync();
    } finally {
      await handle.close();
    }
    await rename(tmpPath, filePath);
  } catch (error) {
    throw new DocumentWriteError(`failed to write document atomically to "${filePath}"`, { filePath }, error);
  } finally {
    await unlink(tmpPath).catch(() => {});
  }
}

/**
 * Creates a new document. Validates first (D5), then confirms no file
 * already backs this version/slug.
 *
 * @throws {InvalidDocumentInputError} if `validateDocument` finds any issue.
 * @throws {DocumentExistsError} if a document already exists at this
 * version/slug.
 * @throws {DocumentWriteError} if the atomic write fails.
 *
 * @example
 * ```ts
 * const result = await createDocument(draft);
 * ```
 */
export async function createDocument(draft: DocumentDraft): Promise<WriteResult> {
  const report = await validateDocument(draft);
  if (!report.valid) {
    throw new InvalidDocumentInputError(`invalid document for "${draft.slug}"`, { issues: report.issues });
  }

  const filePath = resolveDocumentPath(draft.version, draft.slug);
  if (await documentExists(draft.version, draft.slug)) {
    throw new DocumentExistsError(`document "${draft.slug}" already exists in "${draft.version}"`, {
      version: draft.version,
      slug: draft.slug,
    });
  }

  await writeDocumentAtomically(filePath, serializeDocument(draft.frontmatter, draft.body));
  clearContentCache();
  return { filePath, changed: true };
}

/**
 * Updates an existing document in place. Validates first (D5), then
 * confirms a file already backs this version/slug.
 *
 * @throws {InvalidDocumentInputError} if `validateDocument` finds any issue.
 * @throws {ContentNotFoundError} if no document exists at this version/slug.
 * @throws {DocumentWriteError} if the atomic write fails.
 *
 * @example
 * ```ts
 * const result = await updateDocument(draft);
 * ```
 */
export async function updateDocument(draft: DocumentDraft): Promise<WriteResult> {
  const report = await validateDocument(draft);
  if (!report.valid) {
    throw new InvalidDocumentInputError(`invalid document for "${draft.slug}"`, { issues: report.issues });
  }

  const filePath = resolveDocumentPath(draft.version, draft.slug);
  if (!(await documentExists(draft.version, draft.slug))) {
    const existing = await listStoredDocuments(draft.version);
    throw new ContentNotFoundError(`no document for slug "${draft.slug}" in version "${draft.version}"`, {
      slug: draft.slug,
      availableSlugs: existing.map((doc) => doc.slug),
    });
  }

  await writeDocumentAtomically(filePath, serializeDocument(draft.frontmatter, draft.body));
  clearContentCache();
  return { filePath, changed: true };
}

/**
 * Deletes a document, after checking every index invariant deletion could
 * break (T3, D8): no other page's `replacedBy` still points at it, it isn't
 * the version's own `index` page, and it isn't the last remaining page in
 * the version. All three checks run before any filesystem mutation, and all
 * three report via the same `IndexIntegrityError` shape so a caller can
 * uniformly surface "here's what's blocking this delete."
 *
 * @throws {ContentNotFoundError} if no document exists at this version/slug.
 * @throws {IndexIntegrityError} if deleting would break the index - the
 * message and `context.conflicts` name every blocking file.
 *
 * @example
 * ```ts
 * await deleteDocument("v1", "old-tools");
 * ```
 */
export async function deleteDocument(versionId: string, slug: string): Promise<WriteResult> {
  const filePath = resolveDocumentPath(versionId, slug);
  const existing = await listStoredDocuments(versionId);
  const target = existing.find((doc) => doc.slug === slug);

  if (target === undefined) {
    throw new ContentNotFoundError(`no document for slug "${slug}" in version "${versionId}"`, {
      slug,
      availableSlugs: existing.map((doc) => doc.slug),
    });
  }

  if (slug === "index") {
    throw new IndexIntegrityError(
      `cannot delete "index": every documentation version must keep its own index page`,
      { conflicts: [target.filePath] },
    );
  }

  if (existing.length <= 1) {
    throw new IndexIntegrityError(
      `cannot delete "${slug}": it is the last remaining page in version "${versionId}"`,
      { conflicts: [target.filePath] },
    );
  }

  const referrers = existing
    .filter((doc) => doc.frontmatter.replacedBy === slug)
    .map((doc) => doc.filePath);
  if (referrers.length > 0) {
    throw new IndexIntegrityError(
      `cannot delete "${slug}": referenced by replacedBy in ${referrers.join(", ")}`,
      { conflicts: referrers },
    );
  }

  await unlink(filePath);
  clearContentCache();
  return { filePath, changed: true };
}
