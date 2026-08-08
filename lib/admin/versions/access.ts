/**
 * Authorization for the version management admin surface: a self-contained
 * verifier against the pinned session cookie spec v1, since Prompt A owns
 * `lib/admin/session.ts` and that module does not exist on this branch.
 * Implemented independently so it interoperates byte-for-byte with the
 * other two parallel admin branches after merge - a post-merge cleanup is
 * expected to collapse the three duplicate verifiers into one.
 */

import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

import { VersionsAdminUnauthorizedError } from "./errors";

const SESSION_COOKIE_NAME = "aniki_admin_session";
const SESSION_VERSION = 1;
const MIN_SECRET_LENGTH = 32;

interface SessionPayload {
  sub: string;
  iat: number;
  exp: number;
  v: number;
}

function base64UrlDecode(input: string): Buffer | null {
  try {
    return Buffer.from(input, "base64url");
  } catch {
    return null;
  }
}

function isSessionPayloadShape(value: unknown): value is SessionPayload {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const record = value as Record<string, unknown>;
  return (
    typeof record.sub === "string" &&
    typeof record.iat === "number" &&
    typeof record.exp === "number" &&
    typeof record.v === "number"
  );
}

function getSessionSecret(): string | null {
  const secret = process.env.ANIKI_ADMIN_SESSION_SECRET;
  if (secret === undefined || secret.length < MIN_SECRET_LENGTH) {
    return null;
  }
  return secret;
}

function verifySignature(payloadB64Url: string, sigB64Url: string, secret: string): boolean {
  const expected = createHmac("sha256", secret).update(payloadB64Url).digest();
  const actual = base64UrlDecode(sigB64Url);
  if (actual === null || actual.length !== expected.length) {
    return false;
  }
  return timingSafeEqual(actual, expected);
}

/**
 * Verifies a raw `aniki_admin_session` cookie value against the session
 * cookie spec v1, in the mandated order: shape -> HMAC (constant-time,
 * length-guarded before `timingSafeEqual`) -> `v === 1` -> `exp > now`.
 * Never throws - returns the verified payload's `sub`, or `null` for any
 * failure, so `requireVersionsAdmin` can attach one consistent error
 * regardless of which step failed.
 */
function verifySessionCookie(value: string, secret: string): string | null {
  const parts = value.split(".");
  if (parts.length !== 2) {
    return null;
  }
  const [payloadB64Url, sigB64Url] = parts;
  if (
    payloadB64Url === undefined ||
    sigB64Url === undefined ||
    payloadB64Url.length === 0 ||
    sigB64Url.length === 0
  ) {
    return null;
  }

  if (!verifySignature(payloadB64Url, sigB64Url, secret)) {
    return null;
  }

  const payloadBuffer = base64UrlDecode(payloadB64Url);
  if (payloadBuffer === null) {
    return null;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(payloadBuffer.toString("utf-8"));
  } catch {
    return null;
  }

  if (!isSessionPayloadShape(parsed) || parsed.v !== SESSION_VERSION) {
    return null;
  }

  const nowSeconds = Math.floor(Date.now() / 1000);
  if (parsed.exp <= nowSeconds) {
    return null;
  }

  return parsed.sub;
}

/**
 * Verifies the current request's admin session and returns the
 * authenticated username.
 *
 * Fails closed when `ANIKI_ADMIN_ENABLED !== "true"` - checked before the
 * cookie is even read, so a misconfigured or absent env var denies access
 * rather than falling through to cookie verification. `proxy.ts` (owned by
 * Prompt A) is UX routing only, not authorization: every admin page and
 * route handler this module owns must call this function itself.
 *
 * @throws {VersionsAdminUnauthorizedError} when admin mode is disabled, the
 * session secret is missing or under 32 characters, the cookie is absent,
 * or verification fails at any step (shape, signature, version, or
 * expiry).
 *
 * @example
 * ```ts
 * export default async function VersionsAdminPage() {
 *   const { username } = await requireVersionsAdmin();
 *   // ...
 * }
 * ```
 */
export async function requireVersionsAdmin(): Promise<{ username: string }> {
  if (process.env.ANIKI_ADMIN_ENABLED !== "true") {
    throw new VersionsAdminUnauthorizedError("admin mode is disabled", { reason: "admin-disabled" });
  }

  const secret = getSessionSecret();
  if (secret === null) {
    throw new VersionsAdminUnauthorizedError("admin session secret is missing or too short", {
      reason: "invalid-secret-config",
    });
  }

  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME);
  if (sessionCookie === undefined) {
    throw new VersionsAdminUnauthorizedError("admin session cookie is missing", { reason: "missing-cookie" });
  }

  const username = verifySessionCookie(sessionCookie.value, secret);
  if (username === null) {
    throw new VersionsAdminUnauthorizedError("admin session cookie failed verification", {
      reason: "invalid-session",
    });
  }

  return { username };
}
