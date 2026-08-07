/**
 * Password hashing and constant-time credential verification for the
 * single-operator admin account (D2).
 *
 * Every function here runs exclusively in a Node.js request context
 * (the login route handler) - never from `proxy.ts`, which runs on the
 * Edge runtime and cannot use `node:crypto`'s `scrypt`. That constraint is
 * specific to this module; see `session.ts` for the Web Crypto approach
 * used where Edge compatibility is required.
 */

import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";

import { AdminConfigError } from "./errors";
import type { AdminAuthResult, AdminConfig } from "./types";

const HASH_FIELD_COUNT = 6;
const SALT_LENGTH = 16;
const HASH_LENGTH = 64;
const POSITIVE_INTEGER_PATTERN = /^[1-9]\d*$/;
const BASE64_PATTERN = /^[A-Za-z0-9+/]+={0,2}$/;

/** scrypt cost parameters. `N` is the CPU/memory cost factor, `r` the
 * block size, `p` the parallelization factor. */
export interface ScryptParams {
  readonly N: number;
  readonly r: number;
  readonly p: number;
}

/** The interactive-login defaults documented in `README.md`'s hash
 * generator one-liner - callers should not need to override these. */
export const DEFAULT_SCRYPT_PARAMS: ScryptParams = { N: 16384, r: 8, p: 1 };

/**
 * A password hash string, decoded into its component fields. Returned by
 * {@link parsePasswordHash}; `salt` and `hash` are raw bytes, not base64
 * text.
 */
export interface ParsedPasswordHash extends ScryptParams {
  readonly salt: Buffer;
  readonly hash: Buffer;
}

function isValidBase64(value: string): boolean {
  return value.length > 0 && value.length % 4 === 0 && BASE64_PATTERN.test(value);
}

/**
 * Decodes and validates a `scrypt$<N>$<r>$<p>$<saltBase64>$<hashBase64>`
 * password hash string (the format {@link hashPassword} produces and
 * `ANIKI_ADMIN_PASSWORD_HASH` is expected to hold).
 *
 * @throws {AdminConfigError} naming every malformed segment - wrong field
 * count, an algorithm other than `"scrypt"`, a non-integer cost parameter,
 * or salt/hash text that isn't valid base64 - in one aggregated error.
 *
 * @example
 * ```ts
 * const parsed = parsePasswordHash("scrypt$16384$8$1$c2FsdHNhbHQ=$aGFzaGhhc2g=");
 * parsed.N; // 16384
 * ```
 */
export function parsePasswordHash(encoded: string): ParsedPasswordHash {
  const fields = encoded.split("$");

  if (fields.length !== HASH_FIELD_COUNT) {
    const violation = `expected ${HASH_FIELD_COUNT} $-separated fields, got ${fields.length}`;
    throw new AdminConfigError(`invalid password hash: ${violation}`, { violations: [violation] });
  }

  const [algorithm, rawN, rawR, rawP, rawSalt, rawHash] = fields;
  const violations: string[] = [];

  if (algorithm !== "scrypt") {
    violations.push(`unsupported algorithm "${algorithm}" (expected "scrypt")`);
  }
  if (!POSITIVE_INTEGER_PATTERN.test(rawN)) {
    violations.push(`N must be a positive integer, got "${rawN}"`);
  }
  if (!POSITIVE_INTEGER_PATTERN.test(rawR)) {
    violations.push(`r must be a positive integer, got "${rawR}"`);
  }
  if (!POSITIVE_INTEGER_PATTERN.test(rawP)) {
    violations.push(`p must be a positive integer, got "${rawP}"`);
  }
  if (!isValidBase64(rawSalt)) {
    violations.push(`salt must be valid base64, got "${rawSalt}"`);
  }
  if (!isValidBase64(rawHash)) {
    violations.push(`hash must be valid base64, got "${rawHash}"`);
  }

  if (violations.length > 0) {
    throw new AdminConfigError(`invalid password hash:\n${violations.join("\n")}`, { violations });
  }

  return {
    N: Number(rawN),
    r: Number(rawR),
    p: Number(rawP),
    salt: Buffer.from(rawSalt, "base64"),
    hash: Buffer.from(rawHash, "base64"),
  };
}

/**
 * Derives a `scrypt$...` password hash string for `password`, in the
 * format `parsePasswordHash` reads back. This is what
 * `README.md`'s generator one-liner and `verifyPassword`'s round-trip
 * tests use; the admin panel itself never calls this at request time; it
 * only ever verifies an operator-supplied hash.
 *
 * @example
 * ```ts
 * const encoded = await hashPassword("correct-horse-battery-staple");
 * // "scrypt$16384$8$1$<saltBase64>$<hashBase64>"
 * ```
 */
export async function hashPassword(password: string, params: ScryptParams = DEFAULT_SCRYPT_PARAMS): Promise<string> {
  const salt = randomBytes(SALT_LENGTH);
  const derived = await deriveKey(password, salt, HASH_LENGTH, params);
  return ["scrypt", params.N, params.r, params.p, salt.toString("base64"), derived.toString("base64")].join("$");
}

// Wraps the callback form directly rather than `promisify(scrypt)`, whose
// inferred type resolves to the 3-argument overload and silently drops the
// cost-parameter options object.
function deriveKey(password: string, salt: Buffer, keylen: number, params: ScryptParams): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, keylen, { N: params.N, r: params.r, p: params.p }, (error, derivedKey) => {
      if (error !== null) {
        reject(error);
        return;
      }
      resolve(derivedKey);
    });
  });
}

/**
 * Checks `password` against an encoded hash, using async `scrypt` (never
 * `scryptSync`, which would block the event loop for the duration of the
 * derivation on every login request) and a constant-time comparison of
 * the derived digests.
 *
 * @throws {AdminConfigError} if `encoded` itself is malformed - see
 * {@link parsePasswordHash}. A misconfigured `ANIKI_ADMIN_PASSWORD_HASH`
 * is a startup-grade problem, not a "wrong password" outcome, so it
 * propagates rather than resolving to `false`.
 *
 * @example
 * ```ts
 * const ok = await verifyPassword("hunter2", storedHash);
 * ```
 */
export async function verifyPassword(password: string, encoded: string): Promise<boolean> {
  const parsed = parsePasswordHash(encoded);
  const derived = await deriveKey(password, parsed.salt, parsed.hash.length, parsed);
  if (derived.length !== parsed.hash.length) {
    return false;
  }
  return timingSafeEqual(derived, parsed.hash);
}

const DUMMY_PASSWORD_HASH = [
  "scrypt",
  DEFAULT_SCRYPT_PARAMS.N,
  DEFAULT_SCRYPT_PARAMS.r,
  DEFAULT_SCRYPT_PARAMS.p,
  Buffer.alloc(SALT_LENGTH, 0).toString("base64"),
  Buffer.alloc(HASH_LENGTH, 0).toString("base64"),
].join("$");

/**
 * Verifies a login attempt against the configured admin account.
 *
 * Per D4/D6, a wrong username and a wrong password must be
 * indistinguishable in both the result shape and the time taken to
 * produce it: on an unknown username this still runs a full scrypt
 * derivation (against a fixed dummy hash, its result discarded) so the
 * response time matches the known-username path, and both failure modes
 * resolve to the exact same `{ ok: false, reason: "invalid_credentials" }`
 * value.
 *
 * @example
 * ```ts
 * const result = await verifyCredentials(username, password, config);
 * if (result.ok) {
 *   // result.username is set
 * }
 * ```
 */
export async function verifyCredentials(
  username: string,
  password: string,
  config: AdminConfig,
): Promise<AdminAuthResult> {
  if (username !== config.username) {
    await verifyPassword(password, DUMMY_PASSWORD_HASH).catch(() => undefined);
    return { ok: false, reason: "invalid_credentials" };
  }

  const valid = await verifyPassword(password, config.passwordHash);
  if (!valid) {
    return { ok: false, reason: "invalid_credentials" };
  }

  return { ok: true, username: config.username };
}
