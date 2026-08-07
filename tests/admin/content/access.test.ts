import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ContentAdminUnauthorizedError } from "@/lib/admin/content/errors";

const { getMockToken, setMockToken } = vi.hoisted(() => {
  let token: string | undefined;
  return {
    getMockToken: (): string | undefined => token,
    setMockToken: (value: string | undefined): void => {
      token = value;
    },
  };
});

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => {
      const value = getMockToken();
      return name === "aniki_admin_session" && value !== undefined ? { name, value } : undefined;
    },
  }),
}));

const {
  CONTENT_ADMIN_SESSION_COOKIE_NAME,
  readContentAdmin,
  requireContentAdmin,
  verifySessionToken,
} = await import("@/lib/admin/content/access");

const SECRET = "a".repeat(32);

function base64UrlEncodeText(text: string): string {
  return Buffer.from(text, "utf-8").toString("base64url");
}

async function signPayload(payloadB64Url: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payloadB64Url));
  return Buffer.from(new Uint8Array(signature)).toString("base64url");
}

async function mintToken(
  overrides: Partial<{ sub: string; iat: number; exp: number; v: number }> = {},
  secret = SECRET,
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const payload = { sub: "admin", iat: now, exp: now + 3600, v: 1, ...overrides };
  const payloadB64Url = base64UrlEncodeText(JSON.stringify(payload));
  const signature = await signPayload(payloadB64Url, secret);
  return `${payloadB64Url}.${signature}`;
}

describe("verifySessionToken", () => {
  it("accepts a validly signed, unexpired v1 token", async () => {
    const token = await mintToken();
    await expect(verifySessionToken(token, SECRET)).resolves.toEqual({ username: "admin" });
  });

  it("rejects a tampered payload", async () => {
    const token = await mintToken();
    const [, signature] = token.split(".");
    const tamperedPayload = base64UrlEncodeText(JSON.stringify({ sub: "attacker", iat: 1, exp: 9999999999, v: 1 }));
    await expect(verifySessionToken(`${tamperedPayload}.${signature}`, SECRET)).resolves.toBeNull();
  });

  it("rejects a tampered signature", async () => {
    const token = await mintToken();
    const [payload, signature] = token.split(".");
    const flippedChar = signature.at(-1) === "A" ? "B" : "A";
    const tamperedSignature = `${signature.slice(0, -1)}${flippedChar}`;
    await expect(verifySessionToken(`${payload}.${tamperedSignature}`, SECRET)).resolves.toBeNull();
  });

  it("rejects a truncated signature without throwing", async () => {
    const token = await mintToken();
    const [payload, signature] = token.split(".");
    await expect(verifySessionToken(`${payload}.${signature.slice(0, 4)}`, SECRET)).resolves.toBeNull();
  });

  it("rejects an expired token", async () => {
    const now = Math.floor(Date.now() / 1000);
    const token = await mintToken({ iat: now - 7200, exp: now - 3600 });
    await expect(verifySessionToken(token, SECRET)).resolves.toBeNull();
  });

  it('rejects a "v: 2" payload', async () => {
    const token = await mintToken({ v: 2 });
    await expect(verifySessionToken(token, SECRET)).resolves.toBeNull();
  });

  it("rejects a token signed with the wrong secret", async () => {
    const token = await mintToken({}, "b".repeat(32));
    await expect(verifySessionToken(token, SECRET)).resolves.toBeNull();
  });

  it("rejects malformed shapes without throwing", async () => {
    await expect(verifySessionToken("not-a-token", SECRET)).resolves.toBeNull();
    await expect(verifySessionToken("", SECRET)).resolves.toBeNull();
    await expect(verifySessionToken("a.b.c", SECRET)).resolves.toBeNull();
    await expect(verifySessionToken(".", SECRET)).resolves.toBeNull();
    const badShapePayload = base64UrlEncodeText(JSON.stringify({ foo: "bar" }));
    await expect(verifySessionToken(`${badShapePayload}.sig`, SECRET)).resolves.toBeNull();
    const notBase64Payload = "!!!not-base64!!!";
    await expect(verifySessionToken(`${notBase64Payload}.sig`, SECRET)).resolves.toBeNull();
  });
});

describe("CONTENT_ADMIN_SESSION_COOKIE_NAME", () => {
  it("matches the pinned session cookie spec v1 name", () => {
    expect(CONTENT_ADMIN_SESSION_COOKIE_NAME).toBe("aniki_admin_session");
  });
});

describe("readContentAdmin / requireContentAdmin", () => {
  beforeEach(() => {
    setMockToken(undefined);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    setMockToken(undefined);
  });

  it("rejects a structurally valid token when the panel is disabled", async () => {
    vi.stubEnv("ANIKI_ADMIN_ENABLED", "false");
    vi.stubEnv("ANIKI_ADMIN_SESSION_SECRET", SECRET);
    setMockToken(await mintToken());

    await expect(readContentAdmin()).resolves.toBeNull();
    await expect(requireContentAdmin()).rejects.toBeInstanceOf(ContentAdminUnauthorizedError);
  });

  it("rejects when the session secret is missing", async () => {
    vi.stubEnv("ANIKI_ADMIN_ENABLED", "true");
    vi.stubEnv("ANIKI_ADMIN_SESSION_SECRET", "");
    setMockToken(await mintToken());

    await expect(readContentAdmin()).resolves.toBeNull();
  });

  it("rejects when the session secret is too short", async () => {
    vi.stubEnv("ANIKI_ADMIN_ENABLED", "true");
    vi.stubEnv("ANIKI_ADMIN_SESSION_SECRET", "short");
    setMockToken(await mintToken({}, "short"));

    await expect(readContentAdmin()).resolves.toBeNull();
  });

  it("rejects when there is no session cookie", async () => {
    vi.stubEnv("ANIKI_ADMIN_ENABLED", "true");
    vi.stubEnv("ANIKI_ADMIN_SESSION_SECRET", SECRET);

    await expect(readContentAdmin()).resolves.toBeNull();
  });

  it("accepts a valid session when the panel is enabled and configured", async () => {
    vi.stubEnv("ANIKI_ADMIN_ENABLED", "true");
    vi.stubEnv("ANIKI_ADMIN_SESSION_SECRET", SECRET);
    setMockToken(await mintToken({ sub: "aniki" }));

    await expect(readContentAdmin()).resolves.toEqual({ username: "aniki" });
    await expect(requireContentAdmin()).resolves.toEqual({ username: "aniki" });
  });
});
