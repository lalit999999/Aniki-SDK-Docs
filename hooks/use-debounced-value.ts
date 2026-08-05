"use client";

import { useEffect, useState } from "react";

const DEFAULT_DEBOUNCE_MS = 120;

/**
 * Returns `value`, delayed by `delayMs` since its last change. Used to
 * decouple the search input's every-keystroke updates from the (slightly)
 * more expensive re-scoring pass across the whole index, so a fast typist
 * doesn't trigger a full rescore on every character.
 *
 * Clears its pending timer both on unmount and whenever `value` changes
 * again before the delay elapses, so only the final value in a burst of
 * keystrokes ever lands.
 *
 * @example
 * ```ts
 * const debouncedQuery = useDebouncedValue(query, 120);
 * ```
 */
export function useDebouncedValue<T>(value: T, delayMs: number = DEFAULT_DEBOUNCE_MS): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timeout = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timeout);
  }, [value, delayMs]);

  return debounced;
}
