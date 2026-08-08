/**
 * Access guard for the content authoring surface.
 *
 * This branch cannot import Prompt A's `lib/admin/session.ts` - it does
 * not exist here, and importing it would break the typecheck. Instead this
 * module independently implements the pinned "session cookie spec v1" so
 * it interoperates byte-for-byte with whatever cookie Prompt A's login
 * flow issues, once the branches merge:
 *
 * - name: `aniki_admin_session`
 * - value: `<payloadB64Url>.<sigB64Url>`, HMAC-SHA256 over the payload
 * - payload: `{ sub, iat, exp, v: 1 }`, seconds since epoch
 * - secret: `ANIKI_ADMIN_SESSION_SECRET`, minimum 32 characters
 * - verification order: shape -> signature (constant-time) -> `v === 1` -> `exp > now`
 *
 * A post-merge cleanup task collapses this duplicate with Prompt A's
 * implementation; that duplication is expected and acceptable in the
 * meantime (see the Step 9 spec, section 3).
 *
 * Uses the Web Crypto API (`crypto.subtle`) rather than `node:crypto` so
 * this module behaves identically under Vitest's `node` environment and
 * any future edge-adjacent caller, without a runtime-specific branch.
 * `crypto.subtle.verify` performs a constant-time comparison internally
 * and resolves to `false` - never throws - for a truncated, empty, or
 * malformed signature.
 *
 * Every admin route handler and page this branch owns must call
 * `requireContentAdmin()` first (`proxy.ts` is UX routing, not
 * authorization - see Prompt A's `proxy.ts` doc comment).
 */

import { cookies } from "next/headers";

import { ContentAdminUnauthorizedError } from "./errors";

/** The one cookie name every branch's independent session verification
 * must agree on (pinned cross-branch contract, session cookie spec v1). */
export const CONTENT_ADMIN_SESSION_COOKIE_NAME = "aniki_admin_session";

/** Minimum acceptable length for `ANIKI_ADMIN_SESSION_SECRET`, in characters. */
const MIN_SESSION_SECRET_LENGTH = 32;

/** A verified admin session, as handed to `requireContentAdmin`'s callers. */
export interface ContentAdminSession {
  readonly username: string;
}

/** The session payload's shape, checked before its signature or its `v`
 * value - `v` here is a plain `number`, not the literal `1`, because
 * trusting any claim from an unsigned payload before the HMAC check would
 * let attacker-controlled data influence control flow ahead of the one
 * check that actually proves the payload wasn't forged. */
interface RawSessionPayloadShape {
  readonly sub: string;
  readonly iat: number;
  readonly exp: number;
  readonly v: number;
}

function isRawPayloadShape(value: unknown): value is RawSessionPayloadShape {
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

function decodeRawPayload(payloadB64Url: string): RawSessionPayloadShape | null {
  let json: string;
  try {
    json = Buffer.from(payloadB64Url, "base64url").toString("utf-8");
  } catch {
    return null;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return null;
  }
  return isRawPayloadShape(parsed) ? parsed : null;
}

async function importHmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"],
  );
}

/**
 * Verifies `payloadB64Url` against `sigB64Url` in constant time. Never
 * throws: `Buffer.from(..., "base64url")` decodes leniently (it never
 * throws on malformed base64url input, just produces different bytes),
 * and `crypto.subtle.verify` itself resolves to `false` - not a rejected
 * promise - for a signature of any length, including zero.
 */
async function verifySignature(payloadB64Url: string, sigB64Url: string, secret: string): Promise<boolean> {
  const key = await importHmacKey(secret);
  const data = new TextEncoder().encode(payloadB64Url);
  return crypto.subtle.verify("HMAC", key, Buffer.from(sigB64Url, "base64url"), data);
}

/**
 * Verifies a raw session cookie value against the session cookie spec v1's
 * verification order - shape, then signature (constant-time), then
 * version, then expiry. Never throws: any failure at any step resolves to
 * `null`, exactly as if no cookie had been sent at all.
 *
 * Exported (rather than kept private) so it is directly unit-testable
 * without needing a request context or a real `ANIKI_ADMIN_ENABLED` flag.
 *
 * @example
 * ```ts
 * const session = await verifySessionToken(rawCookieValue, secret);
 * if (session === null) {
 *   // treat as anonymous
 * }
 * ```
 */
export async function verifySessionToken(token: string, secret: string): Promise<ContentAdminSession | null> {
  const parts = token.split(".");
  if (parts.length !== 2) {
    return null;
  }
  const [payloadB64Url, signature] = parts;
  if (payloadB64Url.length === 0 || signature.length === 0) {
    return null;
  }

  const raw = decodeRawPayload(payloadB64Url);
  if (raw === null) {
    return null;
  }

  const signatureValid = await verifySignature(payloadB64Url, signature, secret);
  if (!signatureValid) {
    return null;
  }

  if (raw.v !== 1) {
    return null;
  }

  const nowSeconds = Math.floor(Date.now() / 1000);
  if (raw.exp <= nowSeconds) {
    return null;
  }

  return { username: raw.sub };
}

function isContentAdminPanelEnabled(): boolean {
  return process.env.ANIKI_ADMIN_ENABLED === "true";
}

function loadSessionSecret(): string | null {
  const secret = process.env.ANIKI_ADMIN_SESSION_SECRET;
  if (secret === undefined || secret.length < MIN_SESSION_SECRET_LENGTH) {
    return null;
  }
  return secret;
}

/**
 * Reads and verifies the admin session cookie from the current request.
 * Resolves to `null` - never throws - both when there is no valid session
 * and when the panel is disabled or the session secret is missing/too
 * short (fail-closed): a caller never needs a separate disabled-panel
 * branch just to read a session.
 *
 * @example
 * ```ts
 * const session = await readContentAdmin();
 * ```
 */
export async function readContentAdmin(): Promise<ContentAdminSession | null> {
  if (!isContentAdminPanelEnabled()) {
    return null;
  }

  const secret = loadSessionSecret();
  if (secret === null) {
    return null;
  }

  const store = await cookies();
  const token = store.get(CONTENT_ADMIN_SESSION_COOKIE_NAME)?.value;
  if (token === undefined) {
    return null;
  }

  return verifySessionToken(token, secret);
}

/**
 * The function every page and route handler this branch owns must call
 * first to enforce authentication - `proxy.ts` (owned by Prompt A) only
 * handles redirect UX and grants nothing.
 *
 * @throws {ContentAdminUnauthorizedError} if there is no valid admin
 * session, the panel is disabled, or the session secret is missing/too
 * short.
 *
 * @example
 * ```ts
 * export async function GET() {
 *   await requireContentAdmin();
 *   // ...
 * }
 * ```
 */
export async function requireContentAdmin(): Promise<ContentAdminSession> {
  const session = await readContentAdmin();
  if (session === null) {
    throw new ContentAdminUnauthorizedError("no valid admin session");
  }
  return session;
}
