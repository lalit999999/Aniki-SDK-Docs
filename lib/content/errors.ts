/**
 * Error taxonomy for the markdown content system.
 *
 * Every failure path in `lib/content` throws one of the concrete classes
 * below rather than a bare `Error`. A single `error instanceof ContentError`
 * check catches all of them, while `error.code` lets a caller branch on the
 * specific failure without string-matching a message.
 */

/**
 * Discriminant for every error this module can throw. Kept as a union
 * (rather than deriving it from the class list) so it can be imported
 * without pulling in the classes themselves.
 */
export type ContentErrorCode =
  | "CONTENT_DIRECTORY_ERROR"
  | "CONTENT_NOT_FOUND"
  | "FRONTMATTER_INVALID"
  | "DUPLICATE_SLUG"
  | "MARKDOWN_PARSE_ERROR";

/**
 * Base class for every error the content system throws. Not thrown
 * directly - use one of the concrete subclasses below.
 *
 * @example
 * ```ts
 * try {
 *   await getDocBySlug("missing");
 * } catch (error) {
 *   if (error instanceof ContentError) {
 *     console.error(error.code, error.context);
 *   }
 * }
 * ```
 */
export abstract class ContentError extends Error {
  abstract readonly code: ContentErrorCode;
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
   * Plain-object representation suitable for logging or serializing over
   * a boundary (API response, error tracker) that doesn't understand
   * `Error` instances.
   */
  toJSON(): { name: string; code: ContentErrorCode; message: string; context: Readonly<Record<string, unknown>> } {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      context: this.context,
    };
  }
}

/**
 * Thrown when `content/docs` (or a file within it) cannot be read: the
 * directory is missing, unreadable, or a file read fails for any reason.
 *
 * @example
 * ```ts
 * throw new ContentDirectoryError("content directory not found", {
 *   directory: "/repo/content/docs",
 * });
 * ```
 */
export class ContentDirectoryError extends ContentError {
  readonly code = "CONTENT_DIRECTORY_ERROR" as const;

  constructor(message: string, context: { directory: string }, cause?: unknown) {
    super(message, { context, cause });
  }
}

/**
 * Thrown by `getDocBySlug` when the requested slug has no matching file.
 * Carries the full list of valid slugs so the caller (or its error UI)
 * can suggest alternatives instead of a bare 404.
 *
 * @example
 * ```ts
 * throw new ContentNotFoundError("no document for slug \"foo\"", {
 *   slug: "foo",
 *   availableSlugs: ["index", "installation"],
 * });
 * ```
 */
export class ContentNotFoundError extends ContentError {
  readonly code = "CONTENT_NOT_FOUND" as const;

  constructor(
    message: string,
    context: { slug: string; availableSlugs: readonly string[] },
  ) {
    super(message, { context });
  }
}

/**
 * Thrown when a frontmatter block fails Zod validation. `issues` aggregates
 * every failing field, not just the first, so a single fix cycle can
 * address all of them.
 *
 * @example
 * ```ts
 * throw new FrontmatterValidationError("invalid frontmatter", {
 *   filePath: "content/docs/foo.md",
 *   issues: ["category: Invalid enum value", "order: Expected number, received string"],
 * });
 * ```
 */
export class FrontmatterValidationError extends ContentError {
  readonly code = "FRONTMATTER_INVALID" as const;

  constructor(
    message: string,
    context: { filePath: string; issues: readonly string[] },
  ) {
    super(message, { context });
  }
}

/**
 * Thrown when two files in `content/docs` resolve to the same slug. Two
 * documents silently shadowing each other in navigation is a bug that
 * should fail the build immediately rather than surface as "one of my
 * pages vanished."
 *
 * @example
 * ```ts
 * throw new DuplicateSlugError("duplicate slug \"tools\"", {
 *   slug: "tools",
 *   filePaths: ["content/docs/tools.md", "content/docs/Tools.md"],
 * });
 * ```
 */
export class DuplicateSlugError extends ContentError {
  readonly code = "DUPLICATE_SLUG" as const;

  constructor(
    message: string,
    context: { slug: string; filePaths: readonly string[] },
  ) {
    super(message, { context });
  }
}

/**
 * Thrown when `remark-parse` fails to parse a document's markdown into an
 * AST. In practice this should be rare (remark-parse is very permissive),
 * but a malformed file must not crash the whole content index.
 *
 * @example
 * ```ts
 * throw new MarkdownParseError("failed to parse markdown", {
 *   filePath: "content/docs/foo.md",
 * }, cause);
 * ```
 */
export class MarkdownParseError extends ContentError {
  readonly code = "MARKDOWN_PARSE_ERROR" as const;

  constructor(message: string, context: { filePath: string }, cause?: unknown) {
    super(message, { context, cause });
  }
}
