"use client";

import { useCallback, useSyncExternalStore } from "react";

import {
  PACKAGE_MANAGER_STORAGE_KEY,
  readPackageManagerPreference,
  writePackageManagerPreference,
} from "@/lib/doc-components/package-managers";
import type { PackageManager } from "@/lib/doc-components/package-managers";

const DEFAULT_MANAGER: PackageManager = "npm";

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
    if (event.key === null || event.key === PACKAGE_MANAGER_STORAGE_KEY) {
      onStoreChange();
    }
  }
  window.addEventListener("storage", handleStorageEvent);

  return () => {
    listeners.delete(onStoreChange);
    window.removeEventListener("storage", handleStorageEvent);
  };
}

function getSnapshot(): PackageManager | null {
  return readPackageManagerPreference(window.localStorage);
}

function getServerSnapshot(): PackageManager | null {
  return null;
}

export interface UsePackageManagerResult {
  manager: PackageManager;
  setManager: (manager: PackageManager) => void;
}

/**
 * The site-wide package-manager preference (D12), persisted via
 * `lib/doc-components/package-managers.ts`'s pure storage functions - kept
 * out of this hook so the persistence rules are testable without React.
 *
 * Built on `useSyncExternalStore` (the `useRecentSearches`/`useMounted`
 * idiom), not `useEffect` + local state: React requires
 * `getServerSnapshot`'s value on both the server render and the client's
 * first hydration pass, so the manager is guaranteed to be `"npm"` in both
 * places (§3.1) with no hydration-mismatch warning, and no
 * `react-hooks/set-state-in-effect` violation from calling `setState`
 * synchronously inside an effect to adopt the stored value. Only after
 * hydration commits does React re-check `getSnapshot` and pick up the real
 * preference. `setManager` also notifies same-tab listeners directly,
 * since the native `storage` event only fires in *other* tabs.
 *
 * @example
 * ```tsx
 * const { manager, setManager } = usePackageManager();
 * <Tabs value={manager} onValueChange={(next) => setManager(next as PackageManager)}>
 * ```
 */
export function usePackageManager(): UsePackageManagerResult {
  const stored = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const manager = stored ?? DEFAULT_MANAGER;

  const setManager = useCallback((next: PackageManager) => {
    writePackageManagerPreference(window.localStorage, next);
    emitLocalChange();
  }, []);

  return { manager, setManager };
}
