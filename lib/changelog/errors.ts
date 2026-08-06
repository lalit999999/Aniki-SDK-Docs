/**
 * Error taxonomy for the changelog content system. Mirrors
 * `lib/content/errors.ts`'s shape and ergonomics (a `ChangelogError` base
 * with a `code` discriminant, a frozen `context`, and `toJSON()`) so a
 * caller that already knows how to handle `ContentError` recognizes the
 * pattern immediately, without the two taxonomies being the same classes -
 * a changelog failure and a content failure are different domains and
 * should not be caught by the same `instanceof` check.
 */

export type ChangelogErrorCode =
  | "CHANGELOG_DIRECTORY_ERROR"
  | "RELEASE_NOT_FOUND"
  | "RELEASE_FRONTMATTER_INVALID"
  | "DUPLICATE_RELEASE";

/**
 * Base class for every error the changelog system throws. Not thrown
 * directly - use one of the concrete subclasses below.
 */
export abstract class ChangelogError extends Error {
  abstract readonly code: ChangelogErrorCode;
  readonly context: Readonly<Record<string, unknown>>;

  constructor(
    message: string,
    options?: { context?: Record<string, unknown>; cause?: unknown },
  ) {
    super(message, options?.cause !== undefined ? { cause: options.cause } : undefined);
    this.name = this.constructor.name;
    this.context = Object.freeze({ ...(options?.context ?? {}) });
  }

  toJSON(): { name: string; code: ChangelogErrorCode; message: string; context: Readonly<Record<string, unknown>> } {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      context: this.context,
    };
  }
}

/**
 * Thrown when `content/changelog` (or a file within it) cannot be read.
 */
export class ChangelogDirectoryError extends ChangelogError {
  readonly code = "CHANGELOG_DIRECTORY_ERROR" as const;

  constructor(message: string, context: { directory: string }, cause?: unknown) {
    super(message, { context, cause });
  }
}

/**
 * Thrown by `getReleaseBySlug` when the requested slug has no matching
 * release. Carries every known slug so a caller can suggest alternatives.
 */
export class ReleaseNotFoundError extends ChangelogError {
  readonly code = "RELEASE_NOT_FOUND" as const;

  constructor(message: string, context: { slug: string; availableSlugs: readonly string[] }) {
    super(message, { context });
  }
}

/**
 * Thrown when a release's frontmatter fails validation - either Zod schema
 * validation or the loader's own `docsVersion` cross-check against the
 * version registry. `issues` aggregates every failing field.
 */
export class ReleaseFrontmatterInvalidError extends ChangelogError {
  readonly code = "RELEASE_FRONTMATTER_INVALID" as const;

  constructor(message: string, context: { filePath: string; issues: readonly string[] }) {
    super(message, { context });
  }
}

/**
 * Thrown when two release files declare the same `version` (and therefore
 * the same slug).
 */
export class DuplicateReleaseError extends ChangelogError {
  readonly code = "DUPLICATE_RELEASE" as const;

  constructor(message: string, context: { version: string; filePaths: readonly string[] }) {
    super(message, { context });
  }
}
