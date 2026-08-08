/**
 * Public entry point for the content authoring/publish surface.
 *
 * D1: git is the database. Every write this module makes goes straight
 * into the repo's own `content/docs/**`, exactly as a human author would -
 * there is no MongoDB, no separate CMS backend, neither exists in this
 * project and introducing one would fork the content system this panel
 * writes into in two. The direct consequence (T11) is that this panel is a
 * *local and self-hosted authoring tool*: Vercel's (and most serverless)
 * production runtimes mount `content/` read-only, so every function here
 * assumes a writable filesystem. Production deploys leave the panel
 * disabled (`ANIKI_ADMIN_ENABLED` unset) for exactly this reason - this
 * module does not, and cannot, work around a read-only mount.
 *
 * `import "server-only"` mirrors `lib/content/index.ts`: every function
 * reachable from here touches the filesystem or `next/headers`, so an
 * accidental Client Component import becomes a build-time error instead of
 * a confusing runtime bundling failure.
 */

import "server-only";

import { z } from "zod";

import { ContentNotFoundError, docFrontmatterSchema } from "@/lib/content";

import {
  ContentAdminUnauthorizedError,
  DocumentExistsError,
  IndexIntegrityError,
  InvalidDocumentInputError,
  UnsupportedVersionError,
} from "./errors";
import type { DocumentDraft } from "./types";

export * from "./errors";
export * from "./types";

export {
  CONTENT_ADMIN_SESSION_COOKIE_NAME,
  readContentAdmin,
  requireContentAdmin,
  verifySessionToken,
} from "./access";
export type { ContentAdminSession } from "./access";

export {
  assertKnownVersion,
  documentExists,
  resolveDocumentPath,
  slugToFileName,
  validateSlugInput,
} from "./paths";

export { parseDocumentFile, serializeDocument, serializeFrontmatter } from "./frontmatter";
export type { ParsedDocumentFile } from "./frontmatter";

export {
  createDocument,
  deleteDocument,
  listStoredDocuments,
  readStoredDocument,
  updateDocument,
  validateDocument,
} from "./writer";
export type { StoredDocument } from "./writer";

export { canPublish, getPublishState, listDocuments, publishDocument, unpublishDocument } from "./workflow";

/**
 * Request-body shape for `POST /api/admin/content` and the PUT half of
 * `/api/admin/content/[version]/[slug]` - reuses `docFrontmatterSchema`
 * directly for the `frontmatter` field rather than hand-rolling a second
 * copy of the same rules (T8's closed category enum included), so the API
 * boundary and the writer's own strict validation can never drift apart.
 */
export const documentDraftRequestSchema: z.ZodType<DocumentDraft> = z.object({
  version: z.string().min(1),
  slug: z.string().min(1),
  frontmatter: docFrontmatterSchema,
  body: z.string(),
});

/** The uniform envelope every `/api/admin/content/**` route responds with
 * on failure. */
export interface AdminContentErrorEnvelope {
  readonly error: {
    readonly code: string;
    readonly message: string;
    readonly issues?: readonly string[];
    readonly conflicts?: readonly string[];
  };
}

/**
 * Maps any error thrown by this module's access/writer/workflow functions
 * to the HTTP `Response` every `/api/admin/content/**` handler returns on
 * failure - one mapping, so `route.ts`, `[version]/[slug]/route.ts`, and
 * `publish/route.ts` never each reinvent it (and never disagree). A pure
 * function of its input, not itself a route handler, so it is directly
 * unit-testable without a request context - this branch's Vitest setup has
 * no route-handler harness (`environment: "node"`, no jsdom).
 *
 * Anything not recognized as one of this module's own error classes maps to
 * a generic 500 with no message or context from the original error, so an
 * unexpected internal failure never leaks implementation details.
 *
 * @example
 * ```ts
 * try {
 *   await createDocument(draft);
 *   return Response.json(result, { status: 201 });
 * } catch (error) {
 *   return mapAdminContentErrorToResponse(error);
 * }
 * ```
 */
export function mapAdminContentErrorToResponse(error: unknown): Response {
  if (error instanceof InvalidDocumentInputError) {
    const envelope: AdminContentErrorEnvelope = {
      error: {
        code: error.code,
        message: error.message,
        issues: error.context.issues as readonly string[],
      },
    };
    return Response.json(envelope, { status: 400 });
  }

  if (error instanceof ContentAdminUnauthorizedError) {
    const envelope: AdminContentErrorEnvelope = { error: { code: error.code, message: "unauthorized" } };
    return Response.json(envelope, { status: 401 });
  }

  if (error instanceof ContentNotFoundError) {
    const envelope: AdminContentErrorEnvelope = { error: { code: error.code, message: error.message } };
    return Response.json(envelope, { status: 404 });
  }

  if (error instanceof DocumentExistsError) {
    const envelope: AdminContentErrorEnvelope = { error: { code: error.code, message: error.message } };
    return Response.json(envelope, { status: 409 });
  }

  if (error instanceof IndexIntegrityError) {
    const envelope: AdminContentErrorEnvelope = {
      error: {
        code: error.code,
        message: error.message,
        conflicts: error.context.conflicts as readonly string[],
      },
    };
    return Response.json(envelope, { status: 409 });
  }

  if (error instanceof UnsupportedVersionError) {
    const envelope: AdminContentErrorEnvelope = { error: { code: error.code, message: error.message } };
    return Response.json(envelope, { status: 422 });
  }

  const envelope: AdminContentErrorEnvelope = {
    error: { code: "CONTENT_ADMIN_INTERNAL_ERROR", message: "internal error" },
  };
  return Response.json(envelope, { status: 500 });
}
