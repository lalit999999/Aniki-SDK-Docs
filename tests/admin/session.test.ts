import { afterEach, describe, expect, it, vi } from "vitest";

import {
  SESSION_COOKIE_NAME,
  clearSessionCookie,
  issueSession,
  verifySessionToken,
} from "@/lib/admin/session";
import type { AdminConfig } from "@/lib/admin/types";

const config: AdminConfig = {
  username: "admin",
  passwordHash: "unused-in-these-tests",
  sessionSecret: "a".repeat(32),
  sessionTtlSeconds: 43200,
};

const otherSecretConfig: AdminConfig = { ...config, sessionSecret: "b".repeat(32) };

/**
 * Independently signs an arbitrary payload the same way `session.ts`
 * does, so tests can construct tokens `issueSession` itself would never
 * produce (a stale `v`, an already-expired `exp`) without exporting
 * internal signing helpers just for test access.
 */
async function signRawToken(payload: Record<string, unknown>, secret: string): Promise<string> {
  const payloadB64Url = Buffer.from(JSON.stringify(payload), "utf-8").toString("base64url");
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payloadB64Url));
  const sigB64Url = Buffer.from(new Uint8Array(signature)).toString("base64url");
  return `${payloadB64Url}.${sigB64Url}`;
}

describe("SESSION_COOKIE_NAME", () => {
  it("is pinned to the cross-branch contract's exact name", () => {
    expect(SESSION_COOKIE_NAME).toBe("aniki_admin_session");
  });
});

describe("issueSession", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("produces a two-part, dot-separated value", async () => {
    const issued = await issueSession("admin", config);
    expect(issued.value.split(".")).toHaveLength(2);
  });

  it("sets HttpOnly, SameSite=Lax, Path=/, and Max-Age from the TTL", async () => {
    const issued = await issueSession("admin", config);
    expect(issued.cookieOptions).toMatchObject({
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: config.sessionTtlSeconds,
    });
  });

  it("is not Secure outside production", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const issued = await issueSession("admin", config);
    expect(issued.cookieOptions.secure).toBe(false);
  });

  it("is Secure in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const issued = await issueSession("admin", config);
    expect(issued.cookieOptions.secure).toBe(true);
  });
});

describe("verifySessionToken", () => {
  it("round-trips a freshly issued session", async () => {
    const issued = await issueSession("admin", config);
    const session = await verifySessionToken(issued.value, config);
    expect(session).not.toBeNull();
    expect(session?.username).toBe("admin");
    expect(new Date(session!.expiresAt).getTime()).toBeGreaterThan(Date.now());
  });

  it("rejects a tampered payload", async () => {
    const issued = await issueSession("admin", config);
    const [payloadB64Url, signature] = issued.value.split(".");
    const tamperedPayload = Buffer.from(JSON.stringify({ sub: "attacker", iat: 0, exp: 9999999999, v: 1 })).toString(
      "base64url",
    );
    expect(payloadB64Url).not.toBe(tamperedPayload);
    const tampered = `${tamperedPayload}.${signature}`;
    expect(await verifySessionToken(tampered, config)).toBeNull();
  });

  it("rejects a tampered signature", async () => {
    const issued = await issueSession("admin", config);
    const [payloadB64Url, signature] = issued.value.split(".");
    // Flips the first character rather than the last: the trailing base64url
    // character of a 32-byte digest carries two unused padding bits, so
    // toggling it can occasionally decode to the same bytes and produce a
    // false pass. The first character encodes real digest bits, so this
    // tamper is guaranteed to change the decoded signature.
    const flipped = (signature.startsWith("A") ? "B" : "A") + signature.slice(1);
    expect(await verifySessionToken(`${payloadB64Url}.${flipped}`, config)).toBeNull();
  });

  it("does not throw on a truncated signature", async () => {
    const issued = await issueSession("admin", config);
    const [payloadB64Url] = issued.value.split(".");
    await expect(verifySessionToken(`${payloadB64Url}.ab`, config)).resolves.toBeNull();
  });

  it("does not throw on an empty signature segment", async () => {
    const issued = await issueSession("admin", config);
    const [payloadB64Url] = issued.value.split(".");
    await expect(verifySessionToken(`${payloadB64Url}.`, config)).resolves.toBeNull();
  });

  it("does not throw on a completely malformed token", async () => {
    await expect(verifySessionToken("not-a-real-token", config)).resolves.toBeNull();
    await expect(verifySessionToken("", config)).resolves.toBeNull();
    await expect(verifySessionToken("a.b.c", config)).resolves.toBeNull();
  });

  it("rejects an expired session", async () => {
    const nowSeconds = Math.floor(Date.now() / 1000);
    const token = await signRawToken({ sub: "admin", iat: nowSeconds - 100, exp: nowSeconds - 1, v: 1 }, config.sessionSecret);
    expect(await verifySessionToken(token, config)).toBeNull();
  });

  it("rejects a v: 2 payload even with a valid signature", async () => {
    const nowSeconds = Math.floor(Date.now() / 1000);
    const token = await signRawToken(
      { sub: "admin", iat: nowSeconds, exp: nowSeconds + 3600, v: 2 },
      config.sessionSecret,
    );
    expect(await verifySessionToken(token, config)).toBeNull();
  });

  it("rejects a token signed with a different secret", async () => {
    const issued = await issueSession("admin", config);
    expect(await verifySessionToken(issued.value, otherSecretConfig)).toBeNull();
  });
});

describe("clearSessionCookie", () => {
  it("returns an empty value with Max-Age 0", () => {
    const cleared = clearSessionCookie();
    expect(cleared.value).toBe("");
    expect(cleared.cookieOptions.maxAge).toBe(0);
    expect(cleared.cookieOptions.path).toBe("/");
  });
});
