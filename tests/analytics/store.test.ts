/**
 * Exercises both `AnalyticsStore` implementations against the same
 * assertions (`describe.each`) so they can never fold an event, or decide
 * what counts as a new unique, differently - plus the file store's
 * disk-specific behaviour (corrupt JSON, retention pruning, concurrent
 * writes) and `hashVisitor`'s daily salt rotation. `FileAnalyticsStore`
 * runs against a disposable temp directory; nothing here ever touches the
 * real `.aniki-analytics`.
 */
import { mkdir, mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { hashVisitor, resetDailySaltsForTests } from "@/lib/analytics/event";
import { FileAnalyticsStore } from "@/lib/analytics/file-store";
import { MemoryAnalyticsStore } from "@/lib/analytics/memory-store";
import type { AnalyticsEvent, AnalyticsStore } from "@/lib/analytics/types";

const NOW = new Date("2026-08-08T12:00:00.000Z");

function makeEvent(overrides: Partial<AnalyticsEvent> = {}): AnalyticsEvent {
  return {
    path: "/docs/tools",
    versionId: "v1",
    referrerHost: "www.google.com",
    timestamp: NOW.toISOString(),
    ...overrides,
  };
}

const tempDirs: string[] = [];

async function createTempDir(): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), "aniki-analytics-"));
  tempDirs.push(dir);
  return dir;
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});

afterEach(async () => {
  vi.useRealTimers();
  resetDailySaltsForTests();
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe.each([
  { name: "FileAnalyticsStore", create: async (): Promise<AnalyticsStore> => new FileAnalyticsStore(await createTempDir()) },
  { name: "MemoryAnalyticsStore", create: async (): Promise<AnalyticsStore> => new MemoryAnalyticsStore() },
])("$name", ({ create }) => {
  it("round-trips a recorded event through readRange", async () => {
    const store = await create();
    await store.record(makeEvent(), "hash-a");

    const [today] = (await store.readRange(1)).slice(-1);
    expect(today?.date).toBe("2026-08-08");
    expect(today?.paths["/docs/tools"]).toEqual({ views: 1, uniques: 1 });
    expect(today?.referrers["www.google.com"]).toBe(1);
    expect(today?.versions.v1).toBe(1);
  });

  it("deduplicates uniques within a day but counts every view", async () => {
    const store = await create();
    await store.record(makeEvent(), "hash-a");
    await store.record(makeEvent(), "hash-a");
    await store.record(makeEvent(), "hash-b");

    const [today] = (await store.readRange(1)).slice(-1);
    expect(today?.paths["/docs/tools"]).toEqual({ views: 3, uniques: 2 });
  });

  it("counts the same visitor hash as a separate unique on a different day", async () => {
    const store = await create();
    await store.record(makeEvent({ timestamp: "2026-08-07T12:00:00.000Z" }), "hash-a");
    await store.record(makeEvent({ timestamp: "2026-08-08T12:00:00.000Z" }), "hash-a");

    const buckets = await store.readRange(2);
    const day1 = buckets.find((bucket) => bucket.date === "2026-08-07");
    const day2 = buckets.find((bucket) => bucket.date === "2026-08-08");
    expect(day1?.paths["/docs/tools"]?.uniques).toBe(1);
    expect(day2?.paths["/docs/tools"]?.uniques).toBe(1);
  });

  it("handles an empty range without throwing", async () => {
    const store = await create();
    const buckets = await store.readRange(7);
    expect(buckets).toHaveLength(7);
    expect(buckets.every((bucket) => Object.keys(bucket.paths).length === 0)).toBe(true);
  });

  it("loses no events under concurrent record calls", async () => {
    const store = await create();
    const hashes = Array.from({ length: 20 }, (_, i) => `hash-${i}`);
    await Promise.all(hashes.map((hash) => store.record(makeEvent(), hash)));

    const [today] = (await store.readRange(1)).slice(-1);
    expect(today?.paths["/docs/tools"]).toEqual({ views: 20, uniques: 20 });
  });
});

describe("FileAnalyticsStore disk-specific behaviour", () => {
  it("skips a corrupt JSON file rather than throwing", async () => {
    const dir = await createTempDir();
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, "2026-08-08.json"), "{ not valid json", "utf-8");

    const store = new FileAnalyticsStore(dir);
    await expect(store.readRange(1)).resolves.toBeDefined();
    const [today] = (await store.readRange(1)).slice(-1);
    expect(today?.paths).toEqual({});
  });

  it("prunes files older than the retention window", async () => {
    const dir = await createTempDir();
    await mkdir(dir, { recursive: true });
    await writeFile(
      path.join(dir, "2025-01-01.json"),
      JSON.stringify({ date: "2025-01-01", paths: {}, referrers: {}, versions: {}, visitorHashesByPath: {} }),
      "utf-8",
    );

    const store = new FileAnalyticsStore(dir);
    await store.record(makeEvent(), "hash-a");

    const entries = await readdir(dir);
    expect(entries).not.toContain("2025-01-01.json");
  });

  it("reports its status as file-backed", async () => {
    const dir = await createTempDir();
    const store = new FileAnalyticsStore(dir);
    expect(store.describe().kind).toBe("file");
  });
});

describe("MemoryAnalyticsStore", () => {
  it("reports its status as in-memory", () => {
    const store = new MemoryAnalyticsStore();
    expect(store.describe().kind).toBe("memory");
  });
});

describe("hashVisitor", () => {
  it("produces the same hash for the same visitor and day", () => {
    const a = hashVisitor("203.0.113.4", "Mozilla/5.0", "2026-08-08");
    const b = hashVisitor("203.0.113.4", "Mozilla/5.0", "2026-08-08");
    expect(a).toBe(b);
  });

  it("changes the hash across days for the same visitor", () => {
    const day1 = hashVisitor("203.0.113.4", "Mozilla/5.0", "2026-08-08");
    const day2 = hashVisitor("203.0.113.4", "Mozilla/5.0", "2026-08-09");
    expect(day1).not.toBe(day2);
  });

  it("changes the hash for a different visitor on the same day", () => {
    const a = hashVisitor("203.0.113.4", "Mozilla/5.0", "2026-08-08");
    const b = hashVisitor("203.0.113.5", "Mozilla/5.0", "2026-08-08");
    expect(a).not.toBe(b);
  });
});
