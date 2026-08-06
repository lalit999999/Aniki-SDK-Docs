/**
 * Minimal semantic-version comparison for `major.minor.patch` strings (the
 * shape `releaseFrontmatterSchema` already enforces on `version`, so no
 * parsing failure path is needed here).
 */

/**
 * Compares two `major.minor.patch` version strings numerically per
 * segment, never lexicographically - a naive string comparison would put
 * `"1.9.0"` after `"1.10.0"`, since `"1"` sorts after `"1"` but then `"9"`
 * sorts after `"1"` character-by-character.
 *
 * @returns negative if `a` < `b`, positive if `a` > `b`, `0` if equal.
 *
 * @example
 * ```ts
 * compareSemver("1.10.0", "1.9.0"); // > 0 ("1.10.0" is newer)
 * compareSemver("1.0.0", "2.0.0");  // < 0
 * ```
 */
export function compareSemver(a: string, b: string): number {
  const partsA = a.split(".").map(Number);
  const partsB = b.split(".").map(Number);

  for (let index = 0; index < Math.max(partsA.length, partsB.length); index++) {
    const diff = (partsA[index] ?? 0) - (partsB[index] ?? 0);
    if (diff !== 0) {
      return diff;
    }
  }
  return 0;
}
