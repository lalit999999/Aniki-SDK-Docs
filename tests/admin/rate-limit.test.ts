import { afterEach, describe, expect, it } from "vitest";

import {
  MAX_ATTEMPTS,
  WINDOW_MS,
  checkLimit,
  clearAttempts,
  recordFailure,
  resetRateLimiter,
} from "@/lib/admin/rate-limit";

const START = 1_700_000_000_000;

describe("rate limiting", () => {
  afterEach(() => {
    resetRateLimiter();
  });

  it("allows attempts up to the threshold", () => {
    const key = "admin:127.0.0.1";
    for (let i = 0; i < MAX_ATTEMPTS; i++) {
      expect(checkLimit(key, START).allowed).toBe(true);
      recordFailure(key, START);
    }
  });

  it("locks out on the attempt after the threshold is reached", () => {
    const key = "admin:127.0.0.1";
    for (let i = 0; i < MAX_ATTEMPTS; i++) {
      recordFailure(key, START);
    }
    const status = checkLimit(key, START);
    expect(status.allowed).toBe(false);
    expect(status.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("retryAfterSeconds decreases as time advances toward the window's end", () => {
    const key = "admin:127.0.0.1";
    for (let i = 0; i < MAX_ATTEMPTS; i++) {
      recordFailure(key, START);
    }
    const first = checkLimit(key, START + 1_000).retryAfterSeconds;
    const second = checkLimit(key, START + 60_000).retryAfterSeconds;
    expect(second).toBeLessThan(first);
  });

  it("unlocks once the window has fully elapsed", () => {
    const key = "admin:127.0.0.1";
    for (let i = 0; i < MAX_ATTEMPTS; i++) {
      recordFailure(key, START);
    }
    expect(checkLimit(key, START + WINDOW_MS - 1).allowed).toBe(false);
    expect(checkLimit(key, START + WINDOW_MS + 1).allowed).toBe(true);
  });

  it("clears state on a successful login", () => {
    const key = "admin:127.0.0.1";
    for (let i = 0; i < MAX_ATTEMPTS; i++) {
      recordFailure(key, START);
    }
    expect(checkLimit(key, START).allowed).toBe(false);

    clearAttempts(key);

    expect(checkLimit(key, START).allowed).toBe(true);
  });

  it("tracks distinct keys independently", () => {
    const attacker = "admin:10.0.0.1";
    const legitimate = "admin:10.0.0.2";
    for (let i = 0; i < MAX_ATTEMPTS; i++) {
      recordFailure(attacker, START);
    }
    expect(checkLimit(attacker, START).allowed).toBe(false);
    expect(checkLimit(legitimate, START).allowed).toBe(true);
  });

  it("evicts stale entries so they never count toward a later window", () => {
    const key = "admin:127.0.0.1";
    for (let i = 0; i < MAX_ATTEMPTS; i++) {
      recordFailure(key, START);
    }
    expect(checkLimit(key, START).allowed).toBe(false);

    const wellPastTheWindow = START + WINDOW_MS * 2;
    recordFailure(key, wellPastTheWindow);
    // if the five stale failures had not been evicted, this would be
    // attempt number six and the key would still be locked out
    expect(checkLimit(key, wellPastTheWindow).allowed).toBe(true);
  });

  it("a different key is unaffected by another key's stale, evicted history", () => {
    const keyA = "admin:127.0.0.1";
    const keyB = "admin:127.0.0.2";
    for (let i = 0; i < MAX_ATTEMPTS; i++) {
      recordFailure(keyA, START);
    }
    // touching the limiter for an unrelated key at a much later time
    // should trigger the map-wide sweep without disturbing keyB's own,
    // independent (empty) state
    recordFailure(keyB, START + WINDOW_MS * 2);
    expect(checkLimit(keyB, START + WINDOW_MS * 2).allowed).toBe(true);
  });
});
