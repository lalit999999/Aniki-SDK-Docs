/**
 * Error taxonomy for the version registry.
 *
 * These errors are client-safe by construction (D2/T4): they extend `Error`
 * directly rather than `ContentError` from `lib/content/errors.ts`, since
 * that module's tree is filesystem-adjacent and this one must be importable
 * from `next.config.ts` and from Client Components without pulling in
 * `server-only` transitively. The ergonomics (a frozen `context`, a
 * `toJSON()`) intentionally mirror `ContentError` so callers that catch both
 * taxonomies can treat them the same way.
 */

/**
 * Base class for every error `lib/versions` throws. Not thrown directly -
 * use one of the concrete subclasses below.
 */
export abstract class VersionsError extends Error {
  abstract readonly code: string;
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
  toJSON(): { name: string; code: string; message: string; context: Readonly<Record<string, unknown>> } {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      context: this.context,
    };
  }
}

/**
 * Thrown when `DOCS_VERSIONS` in `config/versions.ts` violates one of the
 * registry invariants (D2): duplicate ids, zero or more than one `"latest"`
 * entry, a malformed id, or entries not ordered newest-first. Also thrown by
 * `assertVersionDirectories()` in `lib/content/paths.ts` when the
 * filesystem and the registry disagree about which versions exist (D3).
 *
 * Always aggregates every violation found, not just the first, so a single
 * fix cycle can address them all.
 *
 * @example
 * ```ts
 * throw new VersionConfigError("invalid version registry", {
 *   violations: ["duplicate id \"v1\"", "no version has status \"latest\""],
 * });
 * ```
 */
export class VersionConfigError extends VersionsError {
  readonly code = "VERSION_CONFIG_ERROR" as const;

  constructor(message: string, context: { violations: readonly string[] }) {
    super(message, context);
  }
}

/**
 * Thrown by `getVersionById()` when `id` doesn't match any entry in
 * `DOCS_VERSIONS`.
 *
 * @example
 * ```ts
 * throw new UnknownVersionError("unknown documentation version \"v9\"", {
 *   versionId: "v9",
 *   knownVersionIds: ["v1"],
 * });
 * ```
 */
export class UnknownVersionError extends VersionsError {
  readonly code = "UNKNOWN_VERSION" as const;

  constructor(message: string, context: { versionId: string; knownVersionIds: readonly string[] }) {
    super(message, context);
  }
}
