/**
 * Admin panel configuration: the fail-closed gate every admin page, every
 * `/api/admin/*` route, and `proxy.ts` reads before doing anything else.
 *
 * No `server-only` guard here, unlike most of `lib/admin` - `proxy.ts`
 * imports {@link loadAdminConfig} directly, and Next's middleware bundle
 * runs on the Edge runtime, not in the RSC graph `server-only` special-cases
 * (see `lib/versions/registry.ts` for the same constraint against
 * `next.config.ts`). This module only ever reads `process.env`, so nothing
 * about it actually requires a Node.js runtime.
 *
 * Every function here reads `process.env` at call time, never destructures
 * it at module scope - a module-scope read would freeze whatever value was
 * present at build time into the compiled output, silently ignoring an
 * `ANIKI_ADMIN_ENABLED` flip made afterward (e.g. in a self-hosted
 * deploy's runtime environment).
 */

import { AdminConfigError, AdminDisabledError } from "./errors";
import type { AdminConfig } from "./types";

/** Default session lifetime when `ANIKI_ADMIN_SESSION_TTL_SECONDS` is unset: 12 hours. */
const DEFAULT_SESSION_TTL_SECONDS = 43200;

/** Minimum acceptable length for `ANIKI_ADMIN_SESSION_SECRET`, in characters. */
const MIN_SESSION_SECRET_LENGTH = 32;

/**
 * Whether the admin panel is switched on at all. This is the cheap,
 * non-throwing half of the fail-closed gate - it checks only the feature
 * flag, not whether the rest of the configuration is actually valid. Most
 * callers want {@link loadAdminConfig} instead, which checks both and is
 * the one function every page/route/proxy rule should gate on.
 *
 * @example
 * ```ts
 * if (!isAdminEnabled()) {
 *   // cheap early exit before doing anything else
 * }
 * ```
 */
export function isAdminEnabled(): boolean {
  return process.env.ANIKI_ADMIN_ENABLED === "true";
}

function parsePositiveInteger(raw: string): number | null {
  const parsed = Number(raw);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

/**
 * The configured session TTL in seconds, defaulting to 12 hours when
 * `ANIKI_ADMIN_SESSION_TTL_SECONDS` is unset. Unlike {@link loadAdminConfig},
 * this never throws on a garbage value - it guards by falling back to the
 * default, for callers that need *a* valid number and cannot propagate a
 * config error (e.g. a cookie `Max-Age`, which must never be `NaN`).
 * `loadAdminConfig()` performs its own stricter check so a garbage-but-set
 * value is still surfaced as a startup violation rather than silently
 * ignored.
 *
 * @example
 * ```ts
 * getSessionTtlSeconds(); // 43200 if unset
 * ```
 */
export function getSessionTtlSeconds(): number {
  const raw = process.env.ANIKI_ADMIN_SESSION_TTL_SECONDS;
  if (raw === undefined || raw.trim() === "") {
    return DEFAULT_SESSION_TTL_SECONDS;
  }
  return parsePositiveInteger(raw) ?? DEFAULT_SESSION_TTL_SECONDS;
}

/**
 * Loads and validates the admin panel's environment configuration. This is
 * the single authoritative fail-closed gate (D-fail-closed): every admin
 * page, every `/api/admin/*` handler, and `proxy.ts` should call this and
 * treat *any* thrown error identically - a 404, not a distinct error page -
 * so a disabled panel and a misconfigured one are indistinguishable from
 * the outside.
 *
 * @throws {AdminDisabledError} if `ANIKI_ADMIN_ENABLED` is not `"true"`.
 * @throws {AdminConfigError} if the panel is enabled but `ANIKI_ADMIN_USERNAME`,
 * `ANIKI_ADMIN_PASSWORD_HASH`, or `ANIKI_ADMIN_SESSION_SECRET` is missing/invalid,
 * or `ANIKI_ADMIN_SESSION_TTL_SECONDS` is set but not a positive integer.
 * Aggregates every violation found, not just the first.
 *
 * @example
 * ```ts
 * try {
 *   const config = loadAdminConfig();
 *   // config.username, config.passwordHash, config.sessionSecret, config.sessionTtlSeconds
 * } catch {
 *   notFound();
 * }
 * ```
 */
export function loadAdminConfig(): AdminConfig {
  if (!isAdminEnabled()) {
    throw new AdminDisabledError("admin panel is not enabled");
  }

  const violations: string[] = [];

  const username = process.env.ANIKI_ADMIN_USERNAME ?? "";
  if (username.trim() === "") {
    violations.push("ANIKI_ADMIN_USERNAME is required");
  }

  const passwordHash = process.env.ANIKI_ADMIN_PASSWORD_HASH ?? "";
  if (passwordHash.trim() === "") {
    violations.push("ANIKI_ADMIN_PASSWORD_HASH is required");
  }

  const sessionSecret = process.env.ANIKI_ADMIN_SESSION_SECRET ?? "";
  if (sessionSecret.length === 0) {
    violations.push("ANIKI_ADMIN_SESSION_SECRET is required");
  } else if (sessionSecret.length < MIN_SESSION_SECRET_LENGTH) {
    violations.push(`ANIKI_ADMIN_SESSION_SECRET must be at least ${MIN_SESSION_SECRET_LENGTH} characters`);
  }

  const rawTtl = process.env.ANIKI_ADMIN_SESSION_TTL_SECONDS;
  let sessionTtlSeconds = DEFAULT_SESSION_TTL_SECONDS;
  if (rawTtl !== undefined && rawTtl.trim() !== "") {
    const parsedTtl = parsePositiveInteger(rawTtl);
    if (parsedTtl === null) {
      violations.push(`ANIKI_ADMIN_SESSION_TTL_SECONDS must be a positive integer, got "${rawTtl}"`);
    } else {
      sessionTtlSeconds = parsedTtl;
    }
  }

  if (violations.length > 0) {
    throw new AdminConfigError(`invalid admin configuration:\n${violations.join("\n")}`, { violations });
  }

  return {
    username,
    passwordHash,
    sessionSecret,
    sessionTtlSeconds,
  };
}
