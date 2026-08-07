import { describe, expect, it } from "vitest";

import { ICON_NAMES, resolveIcon } from "@/lib/doc-components/icons";

describe("resolveIcon", () => {
  it.each(ICON_NAMES)('resolves the "%s" icon', (name) => {
    const result = resolveIcon(name);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.icon).toBeDefined();
    }
  });

  it("reports an unknown key, naming it and listing every valid one", () => {
    const result = resolveIcon("banana");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issue).toContain('"banana"');
      for (const name of ICON_NAMES) {
        expect(result.issue).toContain(name);
      }
    }
  });
});
