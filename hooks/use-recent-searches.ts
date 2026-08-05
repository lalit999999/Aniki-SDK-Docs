"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";

import {
  addRecentSearch,
  clearRecentSearches,
  readRecentSearches,
  RECENT_SEARCHES_KEY,
  writeRecentSearches,
} from "@/lib/search/recent-searches";

/** Stable across renders and across the SSR/first-client-render snapshot. */
const EMPTY_RECENT_SEARCHES: readonly string[] = Object.freeze([]);

type Listener = () => void;
const listeners = new Set<Listener>();

function emitLocalChange(): void {
  for (const listener of listeners) {
    listener();
  }
}

function subscribe(onStoreChange: Listener): () => void {
  listeners.add(onStoreChange);

  function handleStorageEvent(event: StorageEvent): void {
    if (event.key === null || event.key === RECENT_SEARCHES_KEY) {
      onStoreChange();
    }
  }
  window.addEventListener("storage", handleStorageEvent);

  return () => {
    listeners.delete(onStoreChange);
    window.removeEventListener("storage", handleStorageEvent);
  };
}

function getSnapshot(): string | null {
  try {
    return window.localStorage.getItem(RECENT_SEARCHES_KEY);
  } catch {
    return null;
  }
}

function getServerSnapshot(): string | null {
  return null;
}

export interface UseRecentSearchesResult {
  /** Newest first, capped at `MAX_RECENT_SEARCHES`. */
  recent: readonly string[];
  /** Records `query`, ignored if blank or a single character. */
  add: (query: string) => void;
  /** Clears the stored history. */
  clear: () => void;
}

/**
 * Persisted recent-search history (D10), backed by `localStorage` behind
 * `readRecentSearches`/`writeRecentSearches`. Built on
 * `useSyncExternalStore` (the `use-media-query.ts` idiom) so the initial
 * render is correct on the client's first paint with no effect-time
 * `setState` call, and a `storage` event listener keeps two open tabs in
 * sync with each other. `add`/`clear` also notify same-tab listeners
 * directly, since the native `storage` event only fires in *other* tabs.
 *
 * @example
 * ```tsx
 * const { recent, add, clear } = useRecentSearches();
 * ```
 */
export function useRecentSearches(): UseRecentSearchesResult {
  const raw = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const recentSearches = useMemo(() => {
    if (raw === null) {
      return EMPTY_RECENT_SEARCHES;
    }

    try {
      const parsed: unknown = JSON.parse(raw);
      return Array.isArray(parsed) &&
        parsed.every((item) => typeof item === "string")
        ? parsed
        : EMPTY_RECENT_SEARCHES;
    } catch {
      return EMPTY_RECENT_SEARCHES;
    }
  }, [raw]);

  const add = useCallback((query: string) => {
    try {
      const current = readRecentSearches(window.localStorage);
      const next = addRecentSearch(current, query);
      writeRecentSearches(window.localStorage, next);
    } catch {
      // Storage unavailable - the query simply isn't remembered.
    }
    emitLocalChange();
  }, []);

  const clear = useCallback(() => {
    try {
      clearRecentSearches(window.localStorage);
    } catch {
      // Storage unavailable - nothing to clear.
    }
    emitLocalChange();
  }, []);

  return { recent: recentSearches, add, clear };
}
