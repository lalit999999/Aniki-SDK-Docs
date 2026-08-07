/**
 * Error taxonomy for the content authoring/publish surface under
 * `lib/admin/content`.
 *
 * Mirrors `lib/content/errors.ts`'s `ContentError` shape exactly (abstract
 * base, `readonly code`, frozen `context`, `toJSON()`) so both families are
 * recognizable as siblings and a single error->response mapper (see
 * `lib/admin/content/index.ts`) can branch on `code` without string-
 * matching a message. Kept as its own hierarchy rather than extending
 * `ContentError` directly - the content system's errors describe a broken
 * *build*; these describe a rejected *write request*, which is a
 * fundamentally different failure mode with a different caller (an HTTP
 * route handler, not `next build`).
 */

/**
 * Discriminant for every error this module can throw. Kept as a union
 * (rather than deriving it from the class list) so it can be imported
 * without pulling in the classes themselves.
 */
export type AdminContentErrorCode =
  | "CONTENT_ADMIN_UNAUTHORIZED"
  | "CONTENT_ADMIN_INVALID_INPUT"
  | "CONTENT_ADMIN_DOCUMENT_EXISTS"
  | "CONTENT_ADMIN_WRITE_FAILED"
  | "CONTENT_ADMIN_INDEX_INTEGRITY"
  | "CONTENT_ADMIN_ILLEGAL_TRANSITION"
  | "CONTENT_ADMIN_UNSUPPORTED_VERSION";

/**
 * Base class for every error the content authoring surface throws. Not
 * thrown directly - use one of the concrete subclasses below.
 *
 * @example
 * ```ts
 * try {
 *   await requireContentAdmin();
 * } catch (error) {
 *   if (error instanceof AdminContentError) {
 *     console.error(error.code, error.context);
 *   }
 * }
 * ```
 */
export abstract class AdminContentError extends Error {
  abstract readonly code: AdminContentErrorCode;
  readonly context: Readonly<Record<string, unknown>>;

  constructor(
    message: string,
    options?: { context?: Record<string, unknown>; cause?: unknown },
  ) {
    super(message, options?.cause !== undefined ? { cause: options.cause } : undefined);
    this.name = this.constructor.name;
    this.context = Object.freeze({ ...(options?.context ?? {}) });
  }

  /**
   * Plain-object representation suitable for the API routes' uniform
   * `{ error: { code, message, issues? } }` envelope, or for logging.
   */
  toJSON(): {
    name: string;
    code: AdminContentErrorCode;
    message: string;
    context: Readonly<Record<string, unknown>>;
  } {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      context: this.context,
    };
  }
}

/**
 * Thrown by {@link "./access".requireContentAdmin} when there is no valid,
 * verified admin session - whether because the panel is disabled, the
 * session secret is missing/too short, or the request's cookie is absent,
 * tampered, expired, or the wrong version. All of those collapse to this
 * one error (fail-closed) so a caller never needs to distinguish "off" from
 * "broken" from "logged out".
 *
 * @example
 * ```ts
 * throw new ContentAdminUnauthorizedError("no valid admin session");
 * ```
 */
export class ContentAdminUnauthorizedError extends AdminContentError {
  readonly code = "CONTENT_ADMIN_UNAUTHORIZED" as const;

  constructor(message: string) {
    super(message);
  }
}

/**
 * Thrown when a document's frontmatter, slug, or body fails validation -
 * a strict-schema violation, a malformed slug, or a dangling `replacedBy`
 * pointer on the document being written. `issues` aggregates every
 * violation found, not just the first, mirroring
 * `FrontmatterValidationError` in `lib/content/errors.ts`.
 *
 * @example
 * ```ts
 * throw new InvalidDocumentInputError("invalid document input", {
 *   issues: ["description: Required", "replacedBy: \"foo\" does not exist"],
 * });
 * ```
 */
export class InvalidDocumentInputError extends AdminContentError {
  readonly code = "CONTENT_ADMIN_INVALID_INPUT" as const;

  constructor(message: string, context: { issues: readonly string[] }) {
    super(message, { context });
  }
}

/**
 * Thrown by {@link "./writer".createDocument} when a document already
 * exists at the target version/slug.
 *
 * @example
 * ```ts
 * throw new DocumentExistsError('document "tools" already exists in "v1"', {
 *   version: "v1",
 *   slug: "tools",
 * });
 * ```
 */
export class DocumentExistsError extends AdminContentError {
  readonly code = "CONTENT_ADMIN_DOCUMENT_EXISTS" as const;

  constructor(message: string, context: { version: string; slug: string }) {
    super(message, { context });
  }
}

/**
 * Thrown when an atomic write (temp file + rename, D4) fails at any step -
 * the temp file couldn't be created, written, or renamed into place. The
 * write's target file is guaranteed untouched (that's the point of
 * writing to a temp file first), so this is always safe to retry.
 *
 * @example
 * ```ts
 * throw new DocumentWriteError("failed to write document atomically", {
 *   filePath: "/repo/content/docs/v1/tools.md",
 * }, cause);
 * ```
 */
export class DocumentWriteError extends AdminContentError {
  readonly code = "CONTENT_ADMIN_WRITE_FAILED" as const;

  constructor(message: string, context: { filePath: string }, cause?: unknown) {
    super(message, { context, cause });
  }
}

/**
 * Thrown when a write or delete would corrupt the content index as a
 * whole (D5) - deleting a page another page's `replacedBy` still points
 * at, deleting a version's `index` page, or deleting the last remaining
 * page of a version. `conflicts` names every file responsible, mirroring
 * `DuplicateSlugError`/dangling-`replacedBy` reporting in
 * `lib/content/errors.ts`.
 *
 * @example
 * ```ts
 * throw new IndexIntegrityError('cannot delete "tools": referenced by replacedBy', {
 *   conflicts: ["content/docs/v1/legacy-tools.md"],
 * });
 * ```
 */
export class IndexIntegrityError extends AdminContentError {
  readonly code = "CONTENT_ADMIN_INDEX_INTEGRITY" as const;

  constructor(message: string, context: { conflicts: readonly string[] }) {
    super(message, { context });
  }
}

/**
 * Thrown when a requested publish-state transition isn't legal - reserved
 * for transitions with no sensible interpretation at all. An already-
 * published `publish` call is NOT this (D6: it's a no-op returning
 * `{ changed: false }`), so in practice this is currently unreachable from
 * `workflow.ts`'s two transitions, but is kept in the taxonomy for a
 * future transition (e.g. archiving) that does have illegal edges.
 *
 * @example
 * ```ts
 * throw new IllegalTransitionError('cannot transition "tools" from "archived" to "draft"', {
 *   from: "archived",
 *   to: "draft",
 * });
 * ```
 */
export class IllegalTransitionError extends AdminContentError {
  readonly code = "CONTENT_ADMIN_ILLEGAL_TRANSITION" as const;

  constructor(message: string, context: { from: string; to: string }) {
    super(message, { context });
  }
}

/**
 * Thrown when a requested version id isn't declared in the version
 * registry (T9) - the admin panel must never create a version directory
 * or write into an undeclared one.
 *
 * @example
 * ```ts
 * throw new UnsupportedVersionError('unknown documentation version "v9"', {
 *   version: "v9",
 * });
 * ```
 */
export class UnsupportedVersionError extends AdminContentError {
  readonly code = "CONTENT_ADMIN_UNSUPPORTED_VERSION" as const;

  constructor(message: string, context: { version: string }) {
    super(message, { context });
  }
}
