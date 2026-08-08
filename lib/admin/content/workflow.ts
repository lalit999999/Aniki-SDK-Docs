/**
 * Draft and publish workflow: the state transitions layered on top of the
 * writer (sub-task 4) and D2's reuse of the existing `draft: true`
 * frontmatter flag - no `next/draftMode()`, no second source of truth for
 * what "published" means.
 */

import { ContentNotFoundError, DOC_CATEGORIES, slugToRoute } from "@/lib/content";
import type { DocFrontmatter } from "@/lib/content";

import { listStoredDocuments, readStoredDocument, updateDocument } from "./writer";
import type {
  DocumentDraft,
  DocumentSummary,
  PublishBlockReason,
  PublishState,
  WriteResult,
} from "./types";

function formatUtcDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

async function requireStoredDocument(versionId: string, slug: string) {
  const doc = await readStoredDocument(versionId, slug);
  if (doc === null) {
    throw new ContentNotFoundError(`no document for slug "${slug}" in version "${versionId}"`, {
      slug,
      availableSlugs: (await listStoredDocuments(versionId)).map((entry) => entry.slug),
    });
  }
  return doc;
}

/**
 * The current publish state of a document, derived from its `draft` flag
 * (D2).
 *
 * @throws {ContentNotFoundError} if no document exists at this version/slug.
 *
 * @example
 * ```ts
 * await getPublishState("v1", "tools"); // "published"
 * ```
 */
export async function getPublishState(versionId: string, slug: string): Promise<PublishState> {
  const doc = await requireStoredDocument(versionId, slug);
  return doc.frontmatter.draft === true ? "draft" : "published";
}

/**
 * Publishes a document: clears `draft`, stamps `updated` with today's date
 * (UTC, `YYYY-MM-DD`), and re-validates through `updateDocument` before
 * writing. Publishing an already-published document is a no-op (D6) -
 * `{ changed: false }`, no write, no `updated` bump - not an error, since a
 * repeated publish click is a perfectly normal thing for an author to do.
 *
 * `now` defaults to `new Date()` but is an explicit parameter so tests can
 * pin the stamped date without faking global timers.
 *
 * @throws {ContentNotFoundError} if no document exists at this version/slug.
 * @throws {InvalidDocumentInputError} if re-validation fails.
 *
 * @example
 * ```ts
 * await publishDocument("v1", "tools", new Date("2026-08-08T00:00:00Z"));
 * // writes updated: "2026-08-08", draft cleared
 * ```
 */
export async function publishDocument(versionId: string, slug: string, now: Date = new Date()): Promise<WriteResult> {
  const doc = await requireStoredDocument(versionId, slug);

  if (doc.frontmatter.draft !== true) {
    return { filePath: doc.filePath, changed: false };
  }

  const frontmatter: DocFrontmatter = {
    ...doc.frontmatter,
    draft: false,
    updated: formatUtcDate(now),
  };
  const draft: DocumentDraft = { version: versionId, slug, frontmatter, body: doc.body };
  return updateDocument(draft);
}

/**
 * Unpublishes a document: sets `draft: true`, leaving `updated` exactly as
 * it was (unpublishing doesn't mean the content itself changed). Mirrors
 * `publishDocument`'s D6 idempotency - unpublishing an already-draft
 * document is a no-op.
 *
 * @throws {ContentNotFoundError} if no document exists at this version/slug.
 * @throws {InvalidDocumentInputError} if re-validation fails.
 *
 * @example
 * ```ts
 * await unpublishDocument("v1", "tools");
 * ```
 */
export async function unpublishDocument(versionId: string, slug: string): Promise<WriteResult> {
  const doc = await requireStoredDocument(versionId, slug);

  if (doc.frontmatter.draft === true) {
    return { filePath: doc.filePath, changed: false };
  }

  const frontmatter: DocFrontmatter = { ...doc.frontmatter, draft: true };
  const draft: DocumentDraft = { version: versionId, slug, frontmatter, body: doc.body };
  return updateDocument(draft);
}

const HEADING_LEVEL_2_PATTERN = /^##(?!#)\s+\S/m;

/**
 * Checks the human-quality preconditions for publishing a draft, beyond the
 * structural validity `updateDocument` itself enforces: a non-empty body, a
 * description that actually says something distinct from the title, a
 * `replacedBy` (if set) that resolves to a real page, and at least one
 * level-2 heading so the page isn't just a bare title. Never throws -
 * returns every blocking reason found (not just the first) so the editor's
 * disabled-publish-button tooltip (sub-task 8) can list them all at once.
 *
 * @example
 * ```ts
 * const reasons = await canPublish(draft);
 * if (reasons.length > 0) {
 *   // disable the publish button, show reasons.map((r) => r.reason)
 * }
 * ```
 */
export async function canPublish(draft: DocumentDraft): Promise<readonly PublishBlockReason[]> {
  const reasons: PublishBlockReason[] = [];

  if (draft.body.trim().length === 0) {
    reasons.push({ reason: "the document body is empty" });
  }

  const description = draft.frontmatter.description.trim();
  const title = draft.frontmatter.title.trim();
  if (description.length === 0) {
    reasons.push({ reason: "a description is required" });
  } else if (description === title) {
    reasons.push({ reason: "the description must not be identical to the title" });
  }

  if (draft.frontmatter.replacedBy !== undefined) {
    try {
      const existing = await listStoredDocuments(draft.version);
      const targetExists = existing.some((doc) => doc.slug === draft.frontmatter.replacedBy);
      if (!targetExists) {
        reasons.push({
          reason: `replacedBy "${draft.frontmatter.replacedBy}" does not match any existing page in version "${draft.version}"`,
        });
      }
    } catch {
      reasons.push({ reason: `could not verify replacedBy "${draft.frontmatter.replacedBy}"` });
    }
  }

  if (!HEADING_LEVEL_2_PATTERN.test(draft.body)) {
    reasons.push({ reason: "the document must contain at least one level-2 (##) heading" });
  }

  return reasons;
}

function toDocumentSummary(doc: Awaited<ReturnType<typeof listStoredDocuments>>[number]): DocumentSummary {
  return {
    version: doc.version,
    slug: doc.slug,
    title: doc.frontmatter.title,
    category: doc.frontmatter.category,
    order: doc.frontmatter.order,
    draft: doc.frontmatter.draft === true,
    deprecated: doc.frontmatter.deprecated === true,
    updatedAt: doc.frontmatter.updated ?? null,
    route: slugToRoute(doc.slug, doc.version),
  };
}

function compareSummaries(a: DocumentSummary, b: DocumentSummary): number {
  const categoryDiff = DOC_CATEGORIES.indexOf(a.category) - DOC_CATEGORIES.indexOf(b.category);
  if (categoryDiff !== 0) {
    return categoryDiff;
  }
  return a.order - b.order;
}

/**
 * Every document in a version, draft or published, sorted by category then
 * order - what the content list page (sub-task 7) renders.
 *
 * TRAP (T6): this deliberately does *not* call `getAllDocs` from
 * `lib/content` - that function hides drafts in production, which is
 * exactly backwards for an authoring surface that must show every page
 * regardless of `NODE_ENV`. It reads the version's directory directly via
 * `listStoredDocuments` instead.
 *
 * @throws {UnsupportedVersionError} if `versionId` isn't declared.
 *
 * @example
 * ```ts
 * const documents = await listDocuments("v1");
 * ```
 */
export async function listDocuments(versionId: string): Promise<DocumentSummary[]> {
  const docs = await listStoredDocuments(versionId);
  return docs.map(toDocumentSummary).sort(compareSummaries);
}
