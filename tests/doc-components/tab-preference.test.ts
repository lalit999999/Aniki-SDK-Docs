import { describe, expect, it, vi } from "vitest";

import { readTabPreference, resolveTabPreference, tabPreferenceKey, writeTabPreference } from "@/lib/doc-components/tab-preference";

function fakeStorage(initial: Record<string, string> = {}): Storage {
  const store = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    clear: () => store.clear(),
    key: (index: number) => [...store.keys()][index] ?? null,
    get length() {
      return store.size;
    },
  };
}

describe("readTabPreference", () => {
  it("returns null when nothing is stored", () => {
    expect(readTabPreference(fakeStorage(), "pkg")).toBeNull();
  });

  it("returns the stored label", () => {
    const storage = fakeStorage({ [tabPreferenceKey("pkg")]: JSON.stringify("pnpm") });
    expect(readTabPreference(storage, "pkg")).toBe("pnpm");
  });

  it("returns null for corrupt JSON", () => {
    const storage = fakeStorage({ [tabPreferenceKey("pkg")]: "{not json" });
    expect(readTabPreference(storage, "pkg")).toBeNull();
  });

  it("returns null when the stored value isn't a string", () => {
    const storage = fakeStorage({ [tabPreferenceKey("pkg")]: JSON.stringify({ label: "pnpm" }) });
    expect(readTabPreference(storage, "pkg")).toBeNull();
  });

  it("returns null when storage.getItem throws", () => {
    const storage: Storage = {
      ...fakeStorage(),
      getItem: () => {
        throw new Error("storage disabled");
      },
    };
    expect(readTabPreference(storage, "pkg")).toBeNull();
  });
});

describe("writeTabPreference", () => {
  it("persists the value as JSON", () => {
    const storage = fakeStorage();
    writeTabPreference(storage, "pkg", "yarn");
    expect(storage.getItem(tabPreferenceKey("pkg"))).toBe(JSON.stringify("yarn"));
  });

  it("silently drops the write when storage.setItem throws", () => {
    const setItem = vi.fn(() => {
      throw new Error("quota exceeded");
    });
    const storage: Storage = { ...fakeStorage(), setItem };
    expect(() => writeTabPreference(storage, "pkg", "yarn")).not.toThrow();
    expect(setItem).toHaveBeenCalled();
  });
});

describe("resolveTabPreference", () => {
  it("returns the fallback when nothing is stored", () => {
    expect(resolveTabPreference(null, ["npm", "pnpm", "yarn"], "npm")).toBe("npm");
  });

  it("returns the stored label when it's still available", () => {
    expect(resolveTabPreference("pnpm", ["npm", "pnpm", "yarn"], "npm")).toBe("pnpm");
  });

  it("falls back when the stored label no longer exists on the page", () => {
    expect(resolveTabPreference("bun", ["npm", "pnpm", "yarn"], "npm")).toBe("npm");
  });
});
