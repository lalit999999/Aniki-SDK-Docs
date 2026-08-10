import { readFile } from "node:fs/promises";
import path from "node:path";

import { describe, expect, it } from "vitest";

const REPO_ROOT = process.cwd();

describe("admin proxy public auth routing", () => {
  it("lets public admin auth routes bypass the config gate first", async () => {
    const source = await readFile(path.join(REPO_ROOT, "proxy.ts"), "utf-8");
    const publicApiCheck = source.indexOf("if (isPublicApiPath(pathname)) {");
    const configLoad = source.indexOf("loadAdminConfig()");

    expect(publicApiCheck).toBeGreaterThanOrEqual(0);
    expect(configLoad).toBeGreaterThanOrEqual(0);
    expect(publicApiCheck).toBeLessThan(configLoad);
  });
});
