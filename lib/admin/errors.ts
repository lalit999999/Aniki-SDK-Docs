/**
 * Error taxonomy for the admin authentication boundary.
 *
 * Every failure path in `lib/admin` and the `/api/admin/auth/*` routes
 * throws one of the concrete classes below rather than a bare `Error`,
 * mirroring `lib/content/errors.ts`'s `ContentError` shape exactly: a
 * single `error instanceof AdminError` check catches all of them, while
 * `error.code` lets a caller (typically a route handler mapping errors to
 * HTTP responses) branch on the specific failure without string-matching
 * a message.
 */

/**
 * Discriminant for every error this module can throw. Kept as a union
 * (rather than deriving it from the class list) so it can be imported
 * without pulling in the classes themselves.
 */
export type AdminErrorCode =
  | "ADMIN_DISABLED"
  | "ADMIN_CONFIG_INVALID"
  | "ADMIN_INVALID_CREDENTIALS"
  | "ADMIN_SESSION_INVALID"
  | "ADMIN_RATE_LIMITED"
  | "ADMIN_UNAUTHORIZED";

/**
 * Base class for every error the admin boundary throws. Not thrown
 * directly - use one of the concrete subclasses below.
 *
 * @example
 * ```ts
 * try {
 *   await requireAdminSession();
 * } catch (error) {
 *   if (error instanceof AdminError) {
 *     console.error(error.code, error.context);
 *   }
 * }
 * ```
 */
export abstract class AdminError extends Error {
  abstract readonly code: AdminErrorCode;
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
  toJSON(): { name: string; code: AdminErrorCode; message: string; context: Readonly<Record<string, unknown>> } {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      context: this.context,
    };
  }
}

/**
 * Thrown by {@link "./config".loadAdminConfig} when
 * `ANIKI_ADMIN_ENABLED` is not the string `"true"`. This is the ordinary,
 * expected state of the panel (the fail-closed default), not a
 * misconfiguration - every caller of `loadAdminConfig()` must treat this
 * identically to {@link AdminConfigError} (404 the request) rather than
 * surfacing it as a distinct condition, so as not to reveal whether the
 * panel is merely off or actually broken.
 *
 * @example
 * ```ts
 * throw new AdminDisabledError("admin panel is not enabled");
 * ```
 */
export class AdminDisabledError extends AdminError {
  readonly code = "ADMIN_DISABLED" as const;

  constructor(message: string) {
    super(message);
  }
}

/**
 * Thrown by {@link "./config".loadAdminConfig} when the panel is enabled
 * but its environment configuration violates an invariant: a missing
 * username, a missing or too-short session secret, a missing password
 * hash, or a malformed TTL. Always aggregates every violation found, not
 * just the first, so a single fix cycle can address them all - mirroring
 * `VersionConfigError` in `lib/versions/errors.ts`.
 *
 * @example
 * ```ts
 * throw new AdminConfigError("invalid admin configuration", {
 *   violations: ["ANIKI_ADMIN_USERNAME is required", "ANIKI_ADMIN_SESSION_SECRET must be at least 32 characters"],
 * });
 * ```
 */
export class AdminConfigError extends AdminError {
  readonly code = "ADMIN_CONFIG_INVALID" as const;

  constructor(message: string, context: { violations: readonly string[] }) {
    super(message, { context });
  }
}

/**
 * Thrown when a login attempt's username/password pair fails verification
 * - whether the username is unknown, the password is wrong, or (per D4)
 * any other reason. `context.username` is for server-side use (e.g. a
 * future audit log); the HTTP layer must always render the single generic
 * "invalid credentials" message regardless of `context`, per D6.
 *
 * @example
 * ```ts
 * throw new InvalidCredentialsError("invalid credentials", { username: "admin" });
 * ```
 */
export class InvalidCredentialsError extends AdminError {
  readonly code = "ADMIN_INVALID_CREDENTIALS" as const;

  constructor(message: string, context: { username: string }) {
    super(message, { context });
  }
}

/**
 * Reserved for callers that need to distinguish a present-but-invalid
 * session (tampered payload, bad signature, expired, wrong version) from
 * no session at all. {@link "./session".verifySessionToken} and
 * {@link "./session".readSession} deliberately never throw this - both
 * collapse every invalid shape to `null` so a malformed cookie can never
 * crash a render (fail-closed) - but a future caller with a legitimate
 * need to log *why* a session was rejected can throw it explicitly.
 *
 * @example
 * ```ts
 * throw new SessionInvalidError("session signature mismatch", { reason: "bad-signature" });
 * ```
 */
export class SessionInvalidError extends AdminError {
  readonly code = "ADMIN_SESSION_INVALID" as const;

  constructor(message: string, context: { reason: string }) {
    super(message, { context });
  }
}

/**
 * Thrown by the login route when {@link "./rate-limit".checkLimit} reports
 * the caller is locked out. `retryAfterSeconds` is surfaced to the client
 * so it can back off intelligently; per D6 the lockout response may say
 * *when* to retry but never *why* it locked (no distinction between "bad
 * password" and "unknown user" lockouts).
 *
 * @example
 * ```ts
 * throw new RateLimitedError("too many attempts", { retryAfterSeconds: 900 });
 * ```
 */
export class RateLimitedError extends AdminError {
  readonly code = "ADMIN_RATE_LIMITED" as const;

  constructor(message: string, context: { retryAfterSeconds: number }) {
    super(message, { context });
  }
}

/**
 * Thrown by {@link "./session".requireAdminSession} when no valid session
 * is present. This is the error every admin page and every privileged
 * route handler this branch owns must be prepared to catch - `proxy.ts`
 * redirects anonymous *browser* navigation away before this would
 * normally fire, but it is not a security boundary (D3), so this is the
 * actual enforcement point.
 *
 * @example
 * ```ts
 * throw new UnauthorizedError("no valid admin session");
 * ```
 */
export class UnauthorizedError extends AdminError {
  readonly code = "ADMIN_UNAUTHORIZED" as const;

  constructor(message: string) {
    super(message);
  }
}
