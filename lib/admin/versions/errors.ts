/**
 * Error taxonomy for the version management admin surface: authorization,
 * registry inspection, and scaffolding. Mirrors `lib/versions/errors.ts`'s
 * shape (a `code` discriminant, a frozen `context`, a `toJSON()`) so
 * callers already familiar with that pattern don't have to learn a second
 * one.
 */

/** Discriminant for every error this module can throw. */
export type AdminVersionsErrorCode =
  | "VERSIONS_ADMIN_UNAUTHORIZED"
  | "INVALID_VERSION_INPUT"
  | "VERSION_SCAFFOLD_ERROR"
  | "VERSION_REGISTRY_WRITE_ERROR";

/**
 * Base class for every error this module throws. Not thrown directly - use
 * one of the concrete subclasses below.
 *
 * @example
 * ```ts
 * try {
 *   await requireVersionsAdmin();
 * } catch (error) {
 *   if (error instanceof AdminVersionsError) {
 *     console.error(error.code, error.context);
 *   }
 * }
 * ```
 */
export abstract class AdminVersionsError extends Error {
  abstract readonly code: AdminVersionsErrorCode;
  readonly context: Readonly<Record<string, unknown>>;

  constructor(message: string, context?: Record<string, unknown>) {
    super(message);
    this.name = this.constructor.name;
    this.context = Object.freeze({ ...(context ?? {}) });
  }

  /**
   * Plain-object representation suitable for logging or serializing over a
   * boundary that doesn't understand `Error` instances.
   */
  toJSON(): {
    name: string;
    code: AdminVersionsErrorCode;
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
 * Thrown by `requireVersionsAdmin()` when the session cookie is missing,
 * malformed, has an invalid signature, or is expired - or when
 * `ANIKI_ADMIN_ENABLED` isn't `"true"` (fail closed). Every admin page and
 * route handler this module owns calls `requireVersionsAdmin()` first and
 * treats this error as "render `notFound()`" or "respond 401", never as a
 * partial render.
 *
 * @example
 * ```ts
 * throw new VersionsAdminUnauthorizedError("admin session invalid", {
 *   reason: "signature-mismatch",
 * });
 * ```
 */
export class VersionsAdminUnauthorizedError extends AdminVersionsError {
  readonly code = "VERSIONS_ADMIN_UNAUTHORIZED" as const;

  constructor(message: string, context: { reason: string }) {
    super(message, context);
  }
}

/**
 * Thrown by `validateNewVersionInput` callers that choose to throw rather
 * than branch on the returned issue list - primarily the API route, which
 * turns this into a 400 response carrying `issues`. Aggregates every
 * violation found, not just the first.
 *
 * @example
 * ```ts
 * throw new InvalidVersionInputError("invalid new version input", {
 *   issues: ["\"v2\" already exists", "releasedAt is not newer than \"v1\" (2026-08-03)"],
 * });
 * ```
 */
export class InvalidVersionInputError extends AdminVersionsError {
  readonly code = "INVALID_VERSION_INPUT" as const;

  constructor(message: string, context: { issues: readonly string[] }) {
    super(message, context);
  }
}

/**
 * Thrown when `scaffoldVersion()` fails after it has started mutating the
 * filesystem (copying the source content directory) but before the write
 * commits - or when rollback itself fails. Distinct from
 * `InvalidVersionInputError`: this indicates an I/O failure, not a bad
 * request, and by the time it's thrown `scaffoldVersion()` has already
 * attempted to restore `config/versions.ts` and remove any temp directory
 * (D4).
 *
 * @example
 * ```ts
 * throw new VersionScaffoldError("failed to copy source content directory", {
 *   sourceVersionId: "v1",
 *   newVersionId: "v2",
 * });
 * ```
 */
export class VersionScaffoldError extends AdminVersionsError {
  readonly code = "VERSION_SCAFFOLD_ERROR" as const;

  constructor(message: string, context: { sourceVersionId: string; newVersionId: string }, cause?: unknown) {
    super(message, context);
    if (cause !== undefined) {
      this.cause = cause;
    }
  }
}

/**
 * Thrown when the atomic rewrite of the `// aniki:versions:start` /
 * `// aniki:versions:end` region in `config/versions.ts` itself fails - the
 * region markers are missing, the file can't be read or written, or the
 * rewritten source doesn't re-parse into a valid `DocsVersion[]` (T2/T3).
 *
 * @example
 * ```ts
 * throw new VersionRegistryWriteError("versions region markers not found", {
 *   filePath: "config/versions.ts",
 * });
 * ```
 */
export class VersionRegistryWriteError extends AdminVersionsError {
  readonly code = "VERSION_REGISTRY_WRITE_ERROR" as const;

  constructor(message: string, context: { filePath: string }, cause?: unknown) {
    super(message, context);
    if (cause !== undefined) {
      this.cause = cause;
    }
  }
}
