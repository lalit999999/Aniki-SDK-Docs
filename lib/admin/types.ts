/**
 * Type definitions for the admin panel's authentication boundary.
 *
 * This module has no runtime behaviour - it exists to give `lib/admin`,
 * the auth API routes, and the admin shell a shared vocabulary for
 * sessions, configuration, and credential checks, mirroring how
 * `lib/content/types.ts` anchors the content system.
 */

/**
 * The wire shape of a session cookie's payload (session cookie spec v1),
 * base64url-encoded and HMAC-signed by {@link "./session".issueSession}.
 * `iat`/`exp` are seconds since epoch (not milliseconds) to keep the
 * encoded payload short. `v` is pinned to the literal `1` so a future
 * incompatible cookie format can be rejected by shape alone rather than
 * by guessing at field meaning.
 *
 * @example
 * ```ts
 * const payload: AdminSessionPayload = { sub: "admin", iat: 1754607600, exp: 1754650800, v: 1 };
 * ```
 */
export interface AdminSessionPayload {
  /** Subject: the authenticated username. */
  readonly sub: string;
  /** Issued-at, seconds since epoch. */
  readonly iat: number;
  /** Expiry, seconds since epoch. */
  readonly exp: number;
  /** Cookie format version. Always `1` today. */
  readonly v: 1;
}

/**
 * A verified admin session, as handed to pages and route handlers by
 * {@link "./session".readSession} and {@link "./session".requireAdminSession}.
 * Timestamps are ISO 8601 strings (not the raw epoch-seconds of
 * {@link AdminSessionPayload}) since every consumer of this type is UI or
 * logging code that wants a human-readable, `Date`-constructible value.
 *
 * @example
 * ```ts
 * const session: AdminSession = {
 *   username: "admin",
 *   issuedAt: "2026-08-08T00:00:00.000Z",
 *   expiresAt: "2026-08-08T12:00:00.000Z",
 * };
 * ```
 */
export interface AdminSession {
  readonly username: string;
  readonly issuedAt: string;
  readonly expiresAt: string;
}

/**
 * Fully validated admin configuration, as produced by
 * {@link "./config".loadAdminConfig}. Every field has already passed its
 * invariant check (secret length, TTL positivity, non-empty credentials) -
 * code holding an `AdminConfig` never needs to re-validate it.
 *
 * Deliberately has no `enabled` field: `loadAdminConfig()` only ever
 * returns successfully when the panel is enabled, so a boolean that would
 * always read `true` here would just be a footgun (easy to check instead
 * of the disabled-throws-first control flow that actually gates access).
 *
 * @example
 * ```ts
 * function greet(config: AdminConfig) {
 *   return `signed in as ${config.username}`;
 * }
 * ```
 */
export interface AdminConfig {
  readonly username: string;
  readonly passwordHash: string;
  readonly sessionSecret: string;
  readonly sessionTtlSeconds: number;
}

/**
 * Outcome of a credential check ({@link "./credentials".verifyCredentials}).
 * A discriminated union on `ok` rather than a boolean-plus-nullable-reason
 * so a caller can narrow with `if (result.ok)` and the compiler drops the
 * `username` field on the failure branch.
 *
 * The failure branch's `reason` only ever holds `"invalid_credentials"` -
 * not a richer enum of "unknown user" vs "wrong password" - because D6
 * requires those two cases (and a disabled panel) to be indistinguishable
 * to the caller. The type itself enforces that indistinguishability rather
 * than leaving it to callers to remember not to branch further.
 *
 * @example
 * ```ts
 * const result = await verifyCredentials("admin", "hunter2", config);
 * if (result.ok) {
 *   console.log(result.username);
 * }
 * ```
 */
export type AdminAuthResult =
  | { readonly ok: true; readonly username: string }
  | { readonly ok: false; readonly reason: "invalid_credentials" };
