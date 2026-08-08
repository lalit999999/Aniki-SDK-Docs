/**
 * Resolves which `AnalyticsStore` implementation is active (D7): probes
 * `ANIKI_ANALYTICS_DIR` for writability once, falls back to
 * `MemoryAnalyticsStore` when it isn't (T10), and memoizes the result for
 * the lifetime of the process so every caller in the same runtime instance
 * shares one store - a fresh `MemoryAnalyticsStore` per call would forget
 * every event between requests, defeating the fallback entirely.
 */

import "server-only";

import { access, constants, mkdir, rm, writeFile } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import path from "node:path";

import { FileAnalyticsStore } from "./file-store";
import { MemoryAnalyticsStore } from "./memory-store";
import type { AnalyticsStore } from "./types";

const DEFAULT_ANALYTICS_DIR_NAME = ".aniki-analytics";

/**
 * Resolves the analytics directory: `ANIKI_ANALYTICS_DIR` when set,
 * otherwise `.aniki-analytics` under the working directory.
 */
export function getAnalyticsDirectory(): string {
  return process.env.ANIKI_ANALYTICS_DIR ?? path.join(process.cwd(), DEFAULT_ANALYTICS_DIR_NAME);
}

async function isDirectoryWritable(directory: string): Promise<boolean> {
  try {
    await mkdir(directory, { recursive: true });
    await access(directory, constants.W_OK);
    const probePath = path.join(directory, `.write-probe-${randomBytes(4).toString("hex")}`);
    await writeFile(probePath, "", "utf-8");
    await rm(probePath, { force: true });
    return true;
  } catch {
    return false;
  }
}

let cachedStore: AnalyticsStore | null = null;
let cachedStorePromise: Promise<AnalyticsStore> | null = null;

async function buildStore(): Promise<AnalyticsStore> {
  const directory = getAnalyticsDirectory();
  const writable = await isDirectoryWritable(directory);
  return writable ? new FileAnalyticsStore(directory) : new MemoryAnalyticsStore();
}

/**
 * Returns the process-wide analytics store, probing writability and
 * constructing it on first call and reusing the same instance thereafter.
 * The dashboard's status card reads `describe()` off this same instance,
 * so what it reports always matches what `record()` actually did.
 *
 * @example
 * ```ts
 * const store = await resolveAnalyticsStore();
 * await store.record(event, visitorHash);
 * ```
 */
export async function resolveAnalyticsStore(): Promise<AnalyticsStore> {
  if (cachedStore !== null) {
    return cachedStore;
  }
  cachedStorePromise ??= buildStore().then((store) => {
    cachedStore = store;
    return store;
  });
  return cachedStorePromise;
}

/**
 * Clears the memoized store so the next `resolveAnalyticsStore()` call
 * re-probes and reconstructs it. Exists for tests that vary
 * `ANIKI_ANALYTICS_DIR` or a directory's permissions between cases.
 *
 * @example
 * ```ts
 * afterEach(() => resetAnalyticsStoreCache());
 * ```
 */
export function resetAnalyticsStoreCache(): void {
  cachedStore = null;
  cachedStorePromise = null;
}
