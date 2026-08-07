import { describe, expect, it } from "vitest";

import { AdminConfigError } from "@/lib/admin/errors";
import {
  DEFAULT_SCRYPT_PARAMS,
  hashPassword,
  parsePasswordHash,
  verifyCredentials,
  verifyPassword,
} from "@/lib/admin/credentials";
import type { AdminConfig } from "@/lib/admin/types";

const FAST_PARAMS = { N: 1024, r: 8, p: 1 };

const baseConfig: AdminConfig = {
  username: "admin",
  passwordHash: "",
  sessionSecret: "a".repeat(32),
  sessionTtlSeconds: 43200,
};

describe("hashPassword / verifyPassword round-trip", () => {
  it("verifies a password against its own freshly-derived hash", async () => {
    const encoded = await hashPassword("correct-horse-battery-staple", FAST_PARAMS);
    expect(await verifyPassword("correct-horse-battery-staple", encoded)).toBe(true);
  });

  it("rejects the wrong password", async () => {
    const encoded = await hashPassword("correct-horse-battery-staple", FAST_PARAMS);
    expect(await verifyPassword("wrong-password", encoded)).toBe(false);
  });

  it("produces a different salt (and hash) on every call", async () => {
    const a = await hashPassword("same-password", FAST_PARAMS);
    const b = await hashPassword("same-password", FAST_PARAMS);
    expect(a).not.toBe(b);
  });

  it("defaults to the documented interactive-login scrypt parameters", async () => {
    expect(DEFAULT_SCRYPT_PARAMS).toEqual({ N: 16384, r: 8, p: 1 });
  });

  it("hashPassword's output re-parses to the same cost parameters", async () => {
    const encoded = await hashPassword("re-parse-me", FAST_PARAMS);
    const parsed = parsePasswordHash(encoded);
    expect(parsed.N).toBe(FAST_PARAMS.N);
    expect(parsed.r).toBe(FAST_PARAMS.r);
    expect(parsed.p).toBe(FAST_PARAMS.p);
    expect(parsed.salt).toHaveLength(16);
    expect(parsed.hash).toHaveLength(64);
  });
});

describe("parsePasswordHash", () => {
  it("rejects the wrong number of fields", () => {
    expect(() => parsePasswordHash("scrypt$16384$8$1$onlyfivefields")).toThrow(AdminConfigError);
  });

  it("rejects an unsupported algorithm", () => {
    try {
      parsePasswordHash("bcrypt$16384$8$1$c2FsdA==$aGFzaA==");
      expect.unreachable("expected parsePasswordHash to throw");
    } catch (error) {
      expect(error).toBeInstanceOf(AdminConfigError);
      const violations = (error as AdminConfigError).context.violations as string[];
      expect(violations.some((v) => v.includes("algorithm"))).toBe(true);
    }
  });

  it("rejects a non-integer N", () => {
    try {
      parsePasswordHash("scrypt$abc$8$1$c2FsdA==$aGFzaA==");
      expect.unreachable("expected parsePasswordHash to throw");
    } catch (error) {
      const violations = (error as AdminConfigError).context.violations as string[];
      expect(violations.some((v) => v.startsWith("N "))).toBe(true);
    }
  });

  it("rejects a non-integer r", () => {
    try {
      parsePasswordHash("scrypt$16384$x$1$c2FsdA==$aGFzaA==");
      expect.unreachable("expected parsePasswordHash to throw");
    } catch (error) {
      const violations = (error as AdminConfigError).context.violations as string[];
      expect(violations.some((v) => v.startsWith("r "))).toBe(true);
    }
  });

  it("rejects a non-integer p", () => {
    try {
      parsePasswordHash("scrypt$16384$8$x$c2FsdA==$aGFzaA==");
      expect.unreachable("expected parsePasswordHash to throw");
    } catch (error) {
      const violations = (error as AdminConfigError).context.violations as string[];
      expect(violations.some((v) => v.startsWith("p "))).toBe(true);
    }
  });

  it("rejects a non-base64 salt", () => {
    try {
      parsePasswordHash("scrypt$16384$8$1$not base64!!$aGFzaA==");
      expect.unreachable("expected parsePasswordHash to throw");
    } catch (error) {
      const violations = (error as AdminConfigError).context.violations as string[];
      expect(violations.some((v) => v.startsWith("salt "))).toBe(true);
    }
  });

  it("rejects a non-base64 hash", () => {
    try {
      parsePasswordHash("scrypt$16384$8$1$c2FsdA==$not base64!!");
      expect.unreachable("expected parsePasswordHash to throw");
    } catch (error) {
      const violations = (error as AdminConfigError).context.violations as string[];
      expect(violations.some((v) => v.startsWith("hash "))).toBe(true);
    }
  });

  it("aggregates every malformed field into one error", () => {
    try {
      parsePasswordHash("bcrypt$x$x$x$!!$!!");
      expect.unreachable("expected parsePasswordHash to throw");
    } catch (error) {
      const violations = (error as AdminConfigError).context.violations as string[];
      expect(violations.length).toBeGreaterThanOrEqual(6);
    }
  });
});

describe("verifyCredentials", () => {
  it("succeeds with the correct username and password", async () => {
    const passwordHash = await hashPassword("hunter2", FAST_PARAMS);
    const config: AdminConfig = { ...baseConfig, passwordHash };
    const result = await verifyCredentials("admin", "hunter2", config);
    expect(result).toEqual({ ok: true, username: "admin" });
  });

  it("fails with the correct username and the wrong password", async () => {
    const passwordHash = await hashPassword("hunter2", FAST_PARAMS);
    const config: AdminConfig = { ...baseConfig, passwordHash };
    const result = await verifyCredentials("admin", "wrong", config);
    expect(result).toEqual({ ok: false, reason: "invalid_credentials" });
  });

  it("fails with an unknown username, in the exact same shape as a wrong password", async () => {
    const passwordHash = await hashPassword("hunter2", FAST_PARAMS);
    const config: AdminConfig = { ...baseConfig, passwordHash };
    const wrongPassword = await verifyCredentials("admin", "wrong", config);
    const unknownUser = await verifyCredentials("nobody", "whatever", config);
    expect(unknownUser).toEqual({ ok: false, reason: "invalid_credentials" });
    expect(unknownUser).toEqual(wrongPassword);
  });
});
