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
  | "VERSION_DRIFT_CONFLICT"
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
 * Thrown by `scaffoldVersion()` when `detectDrift()` reports that the
 * registry and content directories already disagree, refusing to run
 * rather than compound the damage. Distinct from `InvalidVersionInputError`:
 * this is a conflict with existing server state, not a problem with the
 * request body, so the versions API route maps it to `409`, not `400`.
 *
 * @example
 * ```ts
 * throw new VersionDriftConflictError("registry and content already disagree", {
 *   declaredWithoutDirectory: [],
 *   directoryWithoutDeclaration: ["v3"],
 * });
 * ```
 */
export class VersionDriftConflictError extends AdminVersionsError {
  readonly code = "VERSION_DRIFT_CONFLICT" as const;

  constructor(
    message: string,
    context: { declaredWithoutDirectory: readonly string[]; directoryWithoutDeclaration: readonly string[] },
  ) {
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

/** HTTP status and JSON body {@link mapVersionsAdminError} maps an error to. */
export interface VersionsAdminErrorResponse {
  status: number;
  body: Record<string, unknown>;
}

/**
 * Maps any error `requireVersionsAdmin`, `inspectVersions`, or
 * `scaffoldVersion` can throw to an HTTP status and JSON body, shared by
 * both `/api/admin/versions` route handlers so they respond identically to
 * the same failure: unauthorized -> 401, drift present -> 409 with the
 * drift report, invalid input -> 400 with `issues`, a scaffold or registry
 * write failure -> 500 with a safe message that never leaks a filesystem
 * path or stack trace. A pure function - no Next.js imports - so it's
 * unit-testable without constructing a `Request`.
 *
 * @example
 * ```ts
 * try {
 *   await requireVersionsAdmin();
 * } catch (error) {
 *   const { status, body } = mapVersionsAdminError(error);
 *   return Response.json(body, { status });
 * }
 * ```
 */
export function mapVersionsAdminError(error: unknown): VersionsAdminErrorResponse {
  if (error instanceof VersionsAdminUnauthorizedError) {
    return { status: 401, body: { error: "unauthorized" } };
  }

  if (error instanceof VersionDriftConflictError) {
    return {
      status: 409,
      body: {
        error: "version_drift",
        drift: {
          declaredWithoutDirectory: error.context.declaredWithoutDirectory,
          directoryWithoutDeclaration: error.context.directoryWithoutDeclaration,
        },
      },
    };
  }

  if (error instanceof InvalidVersionInputError) {
    return { status: 400, body: { error: "invalid_input", issues: error.context.issues } };
  }

  if (error instanceof VersionScaffoldError || error instanceof VersionRegistryWriteError) {
    return {
      status: 500,
      body: {
        error: "scaffold_failed",
        message: "failed to scaffold the new version; nothing was left partially written",
      },
    };
  }

  return { status: 500, body: { error: "internal_error" } };
}
