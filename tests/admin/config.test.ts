import { afterEach, describe, expect, it, vi } from "vitest";

import { AdminConfigError, AdminDisabledError } from "@/lib/admin/errors";
import { getSessionTtlSeconds, isAdminEnabled, loadAdminConfig } from "@/lib/admin/config";
import type { AdminConfig } from "@/lib/admin/types";

const VALID_SECRET = "a".repeat(32);

function stubValidEnv(overrides: Record<string, string> = {}): void {
  const base: Record<string, string> = {
    ANIKI_ADMIN_ENABLED: "true",
    ANIKI_ADMIN_USERNAME: "admin",
    ANIKI_ADMIN_PASSWORD_HASH: "scrypt$16384$8$1$c2FsdA==$aGFzaA==",
    ANIKI_ADMIN_SESSION_SECRET: VALID_SECRET,
  };
  for (const [key, value] of Object.entries({ ...base, ...overrides })) {
    vi.stubEnv(key, value);
  }
}

function violationsOf(error: unknown): string[] {
  expect(error).toBeInstanceOf(AdminConfigError);
  return (error as AdminConfigError).context.violations as string[];
}

describe("isAdminEnabled", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("is false when ANIKI_ADMIN_ENABLED is unset", () => {
    expect(isAdminEnabled()).toBe(false);
  });

  it('is false for any value other than the literal string "true"', () => {
    vi.stubEnv("ANIKI_ADMIN_ENABLED", "1");
    expect(isAdminEnabled()).toBe(false);
  });

  it('is true when ANIKI_ADMIN_ENABLED is "true"', () => {
    vi.stubEnv("ANIKI_ADMIN_ENABLED", "true");
    expect(isAdminEnabled()).toBe(true);
  });
});

describe("loadAdminConfig", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("throws AdminDisabledError when the panel is disabled", () => {
    expect(() => loadAdminConfig()).toThrow(AdminDisabledError);
  });

  it("throws AdminDisabledError (not AdminConfigError) when disabled even if other vars are also invalid", () => {
    vi.stubEnv("ANIKI_ADMIN_SESSION_SECRET", "too-short");
    expect(() => loadAdminConfig()).toThrow(AdminDisabledError);
  });

  it("returns a full config when every variable is valid", () => {
    stubValidEnv();
    const config: AdminConfig = loadAdminConfig();
    expect(config).toEqual({
      username: "admin",
      passwordHash: "scrypt$16384$8$1$c2FsdA==$aGFzaA==",
      sessionSecret: VALID_SECRET,
      sessionTtlSeconds: 43200,
    });
  });

  it("rejects a missing username", () => {
    stubValidEnv({ ANIKI_ADMIN_USERNAME: "" });
    try {
      loadAdminConfig();
      expect.unreachable("expected loadAdminConfig to throw");
    } catch (error) {
      expect(violationsOf(error).some((v) => v.includes("ANIKI_ADMIN_USERNAME"))).toBe(true);
    }
  });

  it("rejects a missing password hash", () => {
    stubValidEnv({ ANIKI_ADMIN_PASSWORD_HASH: "" });
    try {
      loadAdminConfig();
      expect.unreachable("expected loadAdminConfig to throw");
    } catch (error) {
      expect(violationsOf(error).some((v) => v.includes("ANIKI_ADMIN_PASSWORD_HASH"))).toBe(true);
    }
  });

  it("rejects a missing session secret", () => {
    stubValidEnv({ ANIKI_ADMIN_SESSION_SECRET: "" });
    try {
      loadAdminConfig();
      expect.unreachable("expected loadAdminConfig to throw");
    } catch (error) {
      expect(violationsOf(error).some((v) => v.includes("ANIKI_ADMIN_SESSION_SECRET is required"))).toBe(true);
    }
  });

  it("rejects a session secret shorter than 32 characters", () => {
    stubValidEnv({ ANIKI_ADMIN_SESSION_SECRET: "short-secret" });
    try {
      loadAdminConfig();
      expect.unreachable("expected loadAdminConfig to throw");
    } catch (error) {
      expect(violationsOf(error).some((v) => v.includes("32 characters"))).toBe(true);
    }
  });

  it("falls back to the 43200s default when the TTL is unset", () => {
    stubValidEnv();
    expect(loadAdminConfig().sessionTtlSeconds).toBe(43200);
  });

  it("accepts a valid custom TTL", () => {
    stubValidEnv({ ANIKI_ADMIN_SESSION_TTL_SECONDS: "3600" });
    expect(loadAdminConfig().sessionTtlSeconds).toBe(3600);
  });

  it("rejects a non-numeric TTL", () => {
    stubValidEnv({ ANIKI_ADMIN_SESSION_TTL_SECONDS: "soon" });
    try {
      loadAdminConfig();
      expect.unreachable("expected loadAdminConfig to throw");
    } catch (error) {
      expect(violationsOf(error).some((v) => v.includes("ANIKI_ADMIN_SESSION_TTL_SECONDS"))).toBe(true);
    }
  });

  it("rejects a zero or negative TTL", () => {
    stubValidEnv({ ANIKI_ADMIN_SESSION_TTL_SECONDS: "0" });
    expect(() => loadAdminConfig()).toThrow(AdminConfigError);
  });

  it("aggregates every violation into one error rather than failing on the first", () => {
    stubValidEnv({
      ANIKI_ADMIN_USERNAME: "",
      ANIKI_ADMIN_PASSWORD_HASH: "",
      ANIKI_ADMIN_SESSION_SECRET: "short",
      ANIKI_ADMIN_SESSION_TTL_SECONDS: "not-a-number",
    });
    try {
      loadAdminConfig();
      expect.unreachable("expected loadAdminConfig to throw");
    } catch (error) {
      expect(violationsOf(error).length).toBeGreaterThanOrEqual(4);
    }
  });
});

describe("getSessionTtlSeconds", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("defaults to 43200 when unset", () => {
    expect(getSessionTtlSeconds()).toBe(43200);
  });

  it("returns a configured value", () => {
    vi.stubEnv("ANIKI_ADMIN_SESSION_TTL_SECONDS", "600");
    expect(getSessionTtlSeconds()).toBe(600);
  });

  it("falls back to the default on a garbage value rather than throwing", () => {
    vi.stubEnv("ANIKI_ADMIN_SESSION_TTL_SECONDS", "not-a-number");
    expect(getSessionTtlSeconds()).toBe(43200);
  });

  it("falls back to the default on a zero or negative value", () => {
    vi.stubEnv("ANIKI_ADMIN_SESSION_TTL_SECONDS", "-5");
    expect(getSessionTtlSeconds()).toBe(43200);
  });
});
