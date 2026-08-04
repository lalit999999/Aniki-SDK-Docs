import { useCallback, useSyncExternalStore } from "react";

/**
 * Tracks whether `query` currently matches, via `useSyncExternalStore` so
 * the initial value is correct on the very first client render with no
 * effect-time `setState` call. Server snapshot is always `false` - there
 * is no viewport/media state to read during SSR.
 *
 * @example
 * ```ts
 * const reduceMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
 * ```
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const media = window.matchMedia(query);
      media.addEventListener("change", onChange);
      return () => media.removeEventListener("change", onChange);
    },
    [query],
  );

  const getSnapshot = useCallback(() => window.matchMedia(query).matches, [query]);

  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}
