/**
 * Session cookie spec v1: issuing, verifying, reading, and clearing the
 * admin panel's HMAC-signed, stateless session cookie (D1).
 *
 * Every cryptographic operation here uses the Web Crypto API
 * (`crypto.subtle`) rather than `node:crypto`, unlike `credentials.ts`.
 * That is a deliberate, non-obvious deviation from the letter of the
 * pinned cookie spec (which references `crypto.timingSafeEqual`): this
 * module's `verifySessionToken` is imported directly by `proxy.ts`, which
 * runs on Next's Edge runtime and cannot load `node:crypto`. Web Crypto is
 * a Web-standard global available identically in the Edge runtime, in
 * Node.js request handlers, and in Vitest's `node` test environment, so
 * one implementation works everywhere this module is imported. It also
 * satisfies the spec's actual *requirement* - constant-time signature
 * comparison that never throws on a malformed input - without literally
 * calling `timingSafeEqual`: `crypto.subtle.verify` performs a
 * constant-time comparison internally and returns `false` (never throws)
 * for a truncated, empty, or oversized signature, verified empirically
 * against this project's Node version before relying on it here.
 */

import { cookies } from "next/headers";

import { loadAdminConfig } from "./config";
import { UnauthorizedError } from "./errors";
import type { AdminConfig, AdminSession } from "./types";

/** The one cookie name every branch's independent session verification
 * must agree on (pinned cross-branch contract, session cookie spec v1). */
export const SESSION_COOKIE_NAME = "aniki_admin_session";

/** The `Set-Cookie` attributes {@link issueSession} and
 * {@link clearSessionCookie} produce. `secure` is only `true` in
 * production so local HTTP development still works. */
export interface AdminSessionCookieOptions {
  readonly httpOnly: true;
  readonly sameSite: "lax";
  readonly path: "/";
  readonly secure: boolean;
  readonly maxAge: number;
}

/** A cookie value paired with the options it should be set with. Returned
 * by {@link issueSession} and {@link clearSessionCookie}; deliberately
 * plain data, not a call to `cookies()`, so both are unit-testable without
 * a request context. */
export interface IssuedSessionCookie {
  readonly value: string;
  readonly cookieOptions: AdminSessionCookieOptions;
}

function cookieOptions(maxAge: number): AdminSessionCookieOptions {
  return {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
    maxAge,
  };
}

function base64UrlEncodeBytes(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64url");
}

function base64UrlEncodeText(text: string): string {
  return Buffer.from(text, "utf-8").toString("base64url");
}

async function importHmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

async function signPayload(payloadB64Url: string, secret: string): Promise<string> {
  const key = await importHmacKey(secret);
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payloadB64Url));
  return base64UrlEncodeBytes(new Uint8Array(signature));
}

/**
 * Verifies `payloadB64Url` against `sigB64Url` in constant time. Never
 * throws: an undecodable signature just becomes a byte sequence that
 * `crypto.subtle.verify` correctly reports as non-matching, regardless of
 * its length (verified empirically - see the module docstring).
 */
async function verifySignature(payloadB64Url: string, sigB64Url: string, secret: string): Promise<boolean> {
  const key = await importHmacKey(secret);
  const signatureBytes = Buffer.from(sigB64Url, "base64url");
  const data = new TextEncoder().encode(payloadB64Url);
  return crypto.subtle.verify("HMAC", key, signatureBytes, data);
}

/** The session payload's shape, checked before its signature or its `v`
 * value - `v` here is a plain `number`, not the literal `1`, because
 * trusting *any* claim from an unsigned payload (including "this looks
 * like a v1 token") before the HMAC check would let an attacker-controlled
 * field influence control flow ahead of the one check that actually
 * proves the payload wasn't forged. */
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
  const json = Buffer.from(payloadB64Url, "base64url").toString("utf-8");
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return null;
  }
  return isRawPayloadShape(parsed) ? parsed : null;
}

/**
 * Issues a new session cookie for `username`. Pure - takes the config it
 * needs as a parameter and never touches `cookies()` itself, so it is
 * unit-testable without a request context. The caller (the login route)
 * is responsible for actually setting the cookie.
 *
 * @example
 * ```ts
 * const { value, cookieOptions } = await issueSession("admin", config);
 * (await cookies()).set(SESSION_COOKIE_NAME, value, cookieOptions);
 * ```
 */
export async function issueSession(username: string, config: AdminConfig): Promise<IssuedSessionCookie> {
  const nowSeconds = Math.floor(Date.now() / 1000);
  const payload = {
    sub: username,
    iat: nowSeconds,
    exp: nowSeconds + config.sessionTtlSeconds,
    v: 1 as const,
  };
  const payloadB64Url = base64UrlEncodeText(JSON.stringify(payload));
  const signature = await signPayload(payloadB64Url, config.sessionSecret);

  return {
    value: `${payloadB64Url}.${signature}`,
    cookieOptions: cookieOptions(config.sessionTtlSeconds),
  };
}

/**
 * Verifies a raw cookie value against the session cookie spec v1's
 * verification order - shape, then signature (constant-time), then
 * version, then expiry - and never throws: any failure at any step
 * resolves to `null`, exactly as if no cookie had been sent at all.
 *
 * @example
 * ```ts
 * const session = await verifySessionToken(rawCookieValue, config);
 * if (session === null) {
 *   // treat as anonymous
 * }
 * ```
 */
export async function verifySessionToken(token: string, config: AdminConfig): Promise<AdminSession | null> {
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

  const signatureValid = await verifySignature(payloadB64Url, signature, config.sessionSecret);
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

  return {
    username: raw.sub,
    issuedAt: new Date(raw.iat * 1000).toISOString(),
    expiresAt: new Date(raw.exp * 1000).toISOString(),
  };
}

/**
 * Reads and verifies the admin session cookie from the current request.
 * Resolves to `null` - never throws - both when there is no valid session
 * and when the panel is disabled or misconfigured, so callers never need
 * a separate disabled-panel branch just to read a session.
 *
 * @example
 * ```ts
 * const session = await readSession();
 * ```
 */
export async function readSession(): Promise<AdminSession | null> {
  let config: AdminConfig;
  try {
    config = loadAdminConfig();
  } catch {
    return null;
  }

  const store = await cookies();
  const token = store.get(SESSION_COOKIE_NAME)?.value;
  if (token === undefined) {
    return null;
  }

  return verifySessionToken(token, config);
}

/**
 * The function every admin page and every privileged route handler this
 * branch owns must call to enforce authentication (D3) - `proxy.ts` only
 * handles redirect UX and grants nothing.
 *
 * @throws {UnauthorizedError} if there is no valid admin session.
 *
 * @example
 * ```ts
 * const session = await requireAdminSession().catch(() => redirect("/admin/login"));
 * ```
 */
export async function requireAdminSession(): Promise<AdminSession> {
  const session = await readSession();
  if (session === null) {
    throw new UnauthorizedError("no valid admin session");
  }
  return session;
}

/**
 * The cookie value and options that clear the session cookie - an empty
 * value with `Max-Age=0`. The logout route sets this; it carries no
 * cryptographic material, so unlike {@link issueSession} it needs no
 * config and is synchronous.
 *
 * @example
 * ```ts
 * const cleared = clearSessionCookie();
 * (await cookies()).set(SESSION_COOKIE_NAME, cleared.value, cleared.cookieOptions);
 * ```
 */
export function clearSessionCookie(): IssuedSessionCookie {
  return {
    value: "",
    cookieOptions: cookieOptions(0),
  };
}
