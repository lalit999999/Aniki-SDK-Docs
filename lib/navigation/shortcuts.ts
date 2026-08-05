/**
 * Pure keyboard-shortcut matching, deliberately separated from any DOM or
 * React code so it can be exercised directly under vitest's node-only
 * environment - the "was the user typing in a field?" rule is exactly the
 * kind of logic that looks obviously correct and then silently breaks in
 * production the first time someone tries to type a `[` into a search box.
 */

/**
 * The subset of a `KeyboardEvent` shortcut matching actually needs. Kept
 * separate from `KeyboardEvent` itself so `matchShortcut` can be called with
 * a plain object in tests, with no DOM required.
 */
export interface ShortcutEvent {
  key: string;
  metaKey: boolean;
  ctrlKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
}

/**
 * The subset of `event.target` shortcut matching needs, to decide whether
 * the user is currently typing.
 */
export interface ShortcutTarget {
  tagName: string;
  isContentEditable: boolean;
}

/** Every action a keyboard shortcut can trigger. `⌘K`/`Ctrl+K`/`/` used to
 * open a page-navigation palette here; that palette is retired in favour
 * of the full-text search dialog (`useSearchHotkey`), which owns those
 * keys independently rather than through this shared action set. */
export type ShortcutAction = "previous-page" | "next-page" | "toggle-help";

/**
 * `true` when `target` is a form field or contenteditable region a shortcut
 * key would otherwise be typed into. Every non-modifier shortcut in
 * `SHORTCUTS` is suppressed while this is `true`.
 */
export function isTypingTarget(target: ShortcutTarget | null): boolean {
  if (target === null) {
    return false;
  }
  return target.isContentEditable || target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT";
}

/**
 * One row of the shortcut table: the key(s) that trigger `action` and the
 * label the help dialog shows for it. The single source of truth `matchShortcut`
 * and `ShortcutsDialog` both read from, so the two can never drift apart.
 */
export interface ShortcutDefinition {
  keys: readonly string[];
  action: ShortcutAction;
  label: string;
}

/**
 * The fixed shortcut set (see D8 in the Step 5 spec). `⌘K`/`Ctrl+K` and
 * `/` are deliberately absent - they open the search dialog via its own
 * independent `useSearchHotkey` listener now, not this shared action set.
 */
export const SHORTCUTS: readonly ShortcutDefinition[] = [
  { keys: ["["], action: "previous-page", label: "Previous page" },
  { keys: ["]"], action: "next-page", label: "Next page" },
  { keys: ["?"], action: "toggle-help", label: "Toggle this help dialog" },
];

/**
 * Matches a key event against the fixed shortcut set, returning the action
 * to dispatch or `null` if nothing matches.
 *
 * Any combination including `altKey` always returns `null`, so a shortcut
 * here can never clobber an OS or browser accelerator that happens to share
 * a base key. Any `metaKey`/`ctrlKey` combination also returns `null` -
 * `⌘K`/`Ctrl+K` belongs to the search dialog's own hotkey listener, and
 * this function must not also claim it. Every remaining shortcut is
 * suppressed while `target` is a typing target (see `isTypingTarget`).
 */
export function matchShortcut(event: ShortcutEvent, target: ShortcutTarget | null): ShortcutAction | null {
  if (event.altKey || event.metaKey || event.ctrlKey) {
    return null;
  }

  if (isTypingTarget(target)) {
    return null;
  }

  switch (event.key) {
    case "[":
      return "previous-page";
    case "]":
      return "next-page";
    case "?":
      return "toggle-help";
    default:
      return null;
  }
}
