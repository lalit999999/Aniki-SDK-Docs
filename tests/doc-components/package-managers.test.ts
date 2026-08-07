import { describe, expect, it } from "vitest";

import {
  buildInstallCommand,
  PACKAGE_MANAGER_STORAGE_KEY,
  readPackageManagerPreference,
  writePackageManagerPreference,
} from "@/lib/doc-components/package-managers";

describe("buildInstallCommand", () => {
  it.each([
    ["npm", "npm install aniki-sdk"],
    ["pnpm", "pnpm add aniki-sdk"],
    ["yarn", "yarn add aniki-sdk"],
    ["bun", "bun add aniki-sdk"],
  ] as const)("plain install for %s", (manager, expected) => {
    const result = buildInstallCommand({ manager, packages: ["aniki-sdk"] });
    expect(result).toEqual({ ok: true, command: expected });
  });

  it.each([
    ["npm", "npm install -D aniki-sdk"],
    ["pnpm", "pnpm add -D aniki-sdk"],
    ["yarn", "yarn add -D aniki-sdk"],
    ["bun", "bun add -d aniki-sdk"],
  ] as const)("dev install for %s uses its own short flag", (manager, expected) => {
    const result = buildInstallCommand({ manager, packages: ["aniki-sdk"], dev: true });
    expect(result).toEqual({ ok: true, command: expected });
  });

  it.each([
    ["npm", "npm install -g aniki-sdk"],
    ["pnpm", "pnpm add -g aniki-sdk"],
    ["yarn", "yarn global add aniki-sdk"],
    ["bun", "bun add -g aniki-sdk"],
  ] as const)("global install for %s", (manager, expected) => {
    const result = buildInstallCommand({ manager, packages: ["aniki-sdk"], global: true });
    expect(result).toEqual({ ok: true, command: expected });
  });

  it.each([
    ["npm", "npx create-next-app"],
    ["pnpm", "pnpm dlx create-next-app"],
    ["yarn", "yarn dlx create-next-app"],
    ["bun", "bunx create-next-app"],
  ] as const)("exec for %s", (manager, expected) => {
    const result = buildInstallCommand({ manager, packages: ["create-next-app"], exec: true });
    expect(result).toEqual({ ok: true, command: expected });
  });

  it("joins multiple packages space-separated", () => {
    const result = buildInstallCommand({ manager: "npm", packages: ["zod", "react", "react-dom"] });
    expect(result).toEqual({ ok: true, command: "npm install zod react react-dom" });
  });

  it("global takes precedence over dev when both are set", () => {
    const result = buildInstallCommand({
      manager: "yarn",
      packages: ["aniki-sdk"],
      dev: true,
      global: true,
    });
    expect(result).toEqual({ ok: true, command: "yarn global add aniki-sdk" });
  });

  it("exec takes precedence over both dev and global", () => {
    const result = buildInstallCommand({
      manager: "npm",
      packages: ["create-next-app"],
      dev: true,
      global: true,
      exec: true,
    });
    expect(result).toEqual({ ok: true, command: "npx create-next-app" });
  });

  it("reports an issue instead of a bare install command for an empty package list", () => {
    const result = buildInstallCommand({ manager: "npm", packages: [] });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issue).toContain("at least one package");
    }
  });
});

describe("package manager preference storage", () => {
  function fakeStorage(): Storage {
    const map = new Map<string, string>();
    return {
      getItem: (key) => map.get(key) ?? null,
      setItem: (key, value) => {
        map.set(key, value);
      },
      removeItem: (key) => {
        map.delete(key);
      },
      clear: () => map.clear(),
      key: (index) => Array.from(map.keys())[index] ?? null,
      get length() {
        return map.size;
      },
    };
  }

  it("returns null when nothing is stored", () => {
    expect(readPackageManagerPreference(fakeStorage())).toBeNull();
  });

  it("round-trips a written preference", () => {
    const storage = fakeStorage();
    writePackageManagerPreference(storage, "pnpm");
    expect(readPackageManagerPreference(storage)).toBe("pnpm");
  });

  it("discards a corrupted stored value", () => {
    const storage = fakeStorage();
    storage.setItem(PACKAGE_MANAGER_STORAGE_KEY, "not-a-real-manager");
    expect(readPackageManagerPreference(storage)).toBeNull();
  });

  it("degrades to null when storage throws", () => {
    const throwingStorage: Storage = {
      getItem: () => {
        throw new Error("storage disabled");
      },
      setItem: () => {
        throw new Error("storage disabled");
      },
      removeItem: () => {},
      clear: () => {},
      key: () => null,
      length: 0,
    };
    expect(readPackageManagerPreference(throwingStorage)).toBeNull();
    expect(() => writePackageManagerPreference(throwingStorage, "bun")).not.toThrow();
  });
});
