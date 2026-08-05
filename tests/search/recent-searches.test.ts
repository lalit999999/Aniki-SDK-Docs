import { describe, expect, it } from "vitest";

import {
  MAX_RECENT_SEARCHES,
  RECENT_SEARCHES_KEY,
  addRecentSearch,
  clearRecentSearches,
  readRecentSearches,
  writeRecentSearches,
} from "@/lib/search/recent-searches";

class FakeStorage implements Storage {
  private store = new Map<string, string>();
  get length(): number {
    return this.store.size;
  }
  clear(): void {
    this.store.clear();
  }
  getItem(key: string): string | null {
    return this.store.get(key) ?? null;
  }
  key(index: number): string | null {
    return Array.from(this.store.keys())[index] ?? null;
  }
  removeItem(key: string): void {
    this.store.delete(key);
  }
  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }
}

class ThrowingStorage implements Storage {
  readonly length = 0;
  clear(): void {
    throw new Error("storage disabled");
  }
  getItem(): string | null {
    throw new Error("storage disabled");
  }
  key(): string | null {
    throw new Error("storage disabled");
  }
  removeItem(): void {
    throw new Error("storage disabled");
  }
  setItem(): void {
    throw new Error("storage disabled");
  }
}

describe("addRecentSearch", () => {
  it("promotes a new query to the front", () => {
    expect(addRecentSearch(["tools"], "streaming")).toEqual(["streaming", "tools"]);
  });

  it("dedupes case-insensitively, promoting the newer casing", () => {
    expect(addRecentSearch(["Streaming", "tools"], "streaming")).toEqual(["streaming", "tools"]);
  });

  it("rejects blank and single-character queries", () => {
    expect(addRecentSearch(["tools"], "   ")).toEqual(["tools"]);
    expect(addRecentSearch(["tools"], "a")).toEqual(["tools"]);
  });

  it("caps at MAX_RECENT_SEARCHES", () => {
    const full = Array.from({ length: MAX_RECENT_SEARCHES }, (_, i) => `query-${i}`);
    const result = addRecentSearch(full, "newest");
    expect(result).toHaveLength(MAX_RECENT_SEARCHES);
    expect(result[0]).toBe("newest");
  });
});

describe("readRecentSearches / writeRecentSearches", () => {
  it("round-trips through a real Storage-shaped object", () => {
    const storage = new FakeStorage();
    writeRecentSearches(storage, ["tools", "streaming"]);
    expect(readRecentSearches(storage)).toEqual(["tools", "streaming"]);
  });

  it("returns [] for a missing key", () => {
    expect(readRecentSearches(new FakeStorage())).toEqual([]);
  });

  it("returns [] for corrupt JSON", () => {
    const storage = new FakeStorage();
    storage.setItem(RECENT_SEARCHES_KEY, "{not json");
    expect(readRecentSearches(storage)).toEqual([]);
  });

  it("returns [] rather than throwing when storage access throws", () => {
    expect(readRecentSearches(new ThrowingStorage())).toEqual([]);
    expect(() => writeRecentSearches(new ThrowingStorage(), ["x"])).not.toThrow();
    expect(() => clearRecentSearches(new ThrowingStorage())).not.toThrow();
  });
});
