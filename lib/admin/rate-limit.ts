/**
 * In-memory sliding-window rate limiting for the admin login endpoint
 * (D5).
 *
 * This limiter is per-process and non-persistent: it lives in a module-
 * scope `Map` that is empty again after every restart or redeploy, and is
 * not shared across instances of a multi-process or multi-region
 * deployment. A shared limiter would need shared state (Redis, a
 * database) this project doesn't have. What an in-memory sliding window
 * genuinely does provide is protection against credential stuffing on the
 * single-instance, self-hosted deployment this panel targets (D2) - it is
 * not, and does not claim to be, a distributed rate limiter.
 *
 * Callers are expected to key by `${username}:${clientIp}` (see the login
 * route), but every function here takes an opaque `key: string` and has
 * no opinion on how it was built.
 */

/** Failures allowed within {@link WINDOW_MS} before a key is locked out. */
export const MAX_ATTEMPTS = 5;

/** Both the sliding window's length and the resulting lockout duration:
 * 15 minutes. A key locks out once its failure count reaches
 * {@link MAX_ATTEMPTS} within this window, and unlocks itself as its
 * oldest counted failure ages past it - there is no separate lockout
 * timer to track. */
export const WINDOW_MS = 15 * 60 * 1000;

/** Outcome of a rate-limit check. */
export interface RateLimitStatus {
  readonly allowed: boolean;
  /** Seconds until the key's oldest counted failure ages out of the
   * window and the count drops enough to allow another attempt. `0` when
   * `allowed` is `true`. */
  readonly retryAfterSeconds: number;
}

/** key -> ascending failure timestamps (ms since epoch) within the
 * current window. An entry is removed entirely, not left as an empty
 * array, as soon as every one of its timestamps ages out - see
 * {@link sweep} - so a burst of one-off attempts from many distinct keys
 * cannot grow this map without bound. */
const attempts = new Map<string, number[]>();

function evictOld(timestamps: readonly number[], now: number): number[] {
  const cutoff = now - WINDOW_MS;
  return timestamps.filter((timestamp) => timestamp > cutoff);
}

/** Evicts every expired timestamp for every key, dropping keys left with
 * none. Run at the start of every read/write below, per D5's "on each
 * call" eviction requirement, rather than on a separate timer. */
function sweep(now: number): void {
  for (const [key, timestamps] of attempts) {
    const fresh = evictOld(timestamps, now);
    if (fresh.length === 0) {
      attempts.delete(key);
    } else if (fresh.length !== timestamps.length) {
      attempts.set(key, fresh);
    }
  }
}

/**
 * Records a failed login attempt for `key`. Call this only after a
 * verification failure - a successful login should call
 * {@link clearAttempts} instead.
 *
 * @param now Injectable clock (ms since epoch) so tests never need real
 * timers. Defaults to `Date.now()`.
 *
 * @example
 * ```ts
 * recordFailure(`${username}:${clientIp}`);
 * ```
 */
export function recordFailure(key: string, now: number = Date.now()): void {
  sweep(now);
  // `sweep` just normalized every entry (including `key`'s, if present)
  // to only-unexpired timestamps, so no further eviction is needed here.
  const timestamps = attempts.get(key) ?? [];
  timestamps.push(now);
  attempts.set(key, timestamps);
}

/**
 * Checks whether `key` is currently allowed to attempt a login.
 *
 * @param now Injectable clock (ms since epoch) so tests never need real
 * timers. Defaults to `Date.now()`.
 *
 * @example
 * ```ts
 * const status = checkLimit(`${username}:${clientIp}`);
 * if (!status.allowed) {
 *   // respond 429 with a Retry-After: status.retryAfterSeconds header
 * }
 * ```
 */
export function checkLimit(key: string, now: number = Date.now()): RateLimitStatus {
  sweep(now);
  const timestamps = attempts.get(key) ?? [];

  if (timestamps.length < MAX_ATTEMPTS) {
    return { allowed: true, retryAfterSeconds: 0 };
  }

  const oldest = timestamps[0] ?? now;
  const retryAfterMs = Math.max(0, oldest + WINDOW_MS - now);
  return { allowed: false, retryAfterSeconds: Math.ceil(retryAfterMs / 1000) };
}

/**
 * Clears every recorded failure for `key`. Call this after a successful
 * login so a legitimate operator who mistyped their password a few times
 * isn't left partway toward a lockout.
 *
 * @example
 * ```ts
 * clearAttempts(`${username}:${clientIp}`);
 * ```
 */
export function clearAttempts(key: string): void {
  attempts.delete(key);
}

/**
 * Clears every key's state. Exists for tests, which would otherwise leak
 * state across cases through this module's shared, process-lifetime map.
 *
 * @example
 * ```ts
 * afterEach(() => resetRateLimiter());
 * ```
 */
export function resetRateLimiter(): void {
  attempts.clear();
}
