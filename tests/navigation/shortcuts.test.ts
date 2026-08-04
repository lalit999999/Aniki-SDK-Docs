import { describe, expect, it } from "vitest";

import { isTypingTarget, matchShortcut } from "@/lib/navigation/shortcuts";
import type { ShortcutEvent, ShortcutTarget } from "@/lib/navigation/shortcuts";

function key(overrides: Partial<ShortcutEvent> & Pick<ShortcutEvent, "key">): ShortcutEvent {
  return { metaKey: false, ctrlKey: false, altKey: false, shiftKey: false, ...overrides };
}

const INPUT: ShortcutTarget = { tagName: "INPUT", isContentEditable: false };
const TEXTAREA: ShortcutTarget = { tagName: "TEXTAREA", isContentEditable: false };
const SELECT: ShortcutTarget = { tagName: "SELECT", isContentEditable: false };
const CONTENT_EDITABLE: ShortcutTarget = { tagName: "DIV", isContentEditable: true };
const BODY: ShortcutTarget = { tagName: "BODY", isContentEditable: false };

describe("isTypingTarget", () => {
  it("is true for INPUT, TEXTAREA, SELECT, and contenteditable elements", () => {
    expect(isTypingTarget(INPUT)).toBe(true);
    expect(isTypingTarget(TEXTAREA)).toBe(true);
    expect(isTypingTarget(SELECT)).toBe(true);
    expect(isTypingTarget(CONTENT_EDITABLE)).toBe(true);
  });

  it("is false for a plain element or null", () => {
    expect(isTypingTarget(BODY)).toBe(false);
    expect(isTypingTarget(null)).toBe(false);
  });
});

describe("matchShortcut", () => {
  it("matches [ and ] to previous-page and next-page", () => {
    expect(matchShortcut(key({ key: "[" }), BODY)).toBe("previous-page");
    expect(matchShortcut(key({ key: "]" }), BODY)).toBe("next-page");
  });

  it("matches ? to toggle-help, including when produced by Shift+/", () => {
    expect(matchShortcut(key({ key: "?" }), BODY)).toBe("toggle-help");
    expect(matchShortcut(key({ key: "?", shiftKey: true }), BODY)).toBe("toggle-help");
  });

  it("does not match [ or ] while a typing target is focused", () => {
    expect(matchShortcut(key({ key: "[" }), INPUT)).toBeNull();
    expect(matchShortcut(key({ key: "]" }), TEXTAREA)).toBeNull();
    expect(matchShortcut(key({ key: "?" }), CONTENT_EDITABLE)).toBeNull();
  });

  it("never matches when altKey is held", () => {
    expect(matchShortcut(key({ key: "[", altKey: true }), BODY)).toBeNull();
    expect(matchShortcut(key({ key: "]", altKey: true }), BODY)).toBeNull();
  });

  it("returns null for unknown keys", () => {
    expect(matchShortcut(key({ key: "a" }), BODY)).toBeNull();
    expect(matchShortcut(key({ key: "Enter" }), BODY)).toBeNull();
  });

  it("does not match [ or ] alongside a meta or ctrl modifier", () => {
    expect(matchShortcut(key({ key: "[", metaKey: true }), BODY)).toBeNull();
    expect(matchShortcut(key({ key: "]", ctrlKey: true }), BODY)).toBeNull();
  });

  it("matches Cmd+K and Ctrl+K to open-palette, even while typing", () => {
    expect(matchShortcut(key({ key: "k", metaKey: true }), BODY)).toBe("open-palette");
    expect(matchShortcut(key({ key: "k", ctrlKey: true }), BODY)).toBe("open-palette");
    expect(matchShortcut(key({ key: "k", metaKey: true }), INPUT)).toBe("open-palette");
  });

  it("does not match Alt+Cmd+K", () => {
    expect(matchShortcut(key({ key: "k", metaKey: true, altKey: true }), BODY)).toBeNull();
  });

  it("matches / to open-palette, but not while typing", () => {
    expect(matchShortcut(key({ key: "/" }), BODY)).toBe("open-palette");
    expect(matchShortcut(key({ key: "/" }), INPUT)).toBeNull();
  });
});
