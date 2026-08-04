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

/** Every action a keyboard shortcut can trigger. */
export type ShortcutAction = "previous-page" | "next-page" | "toggle-help" | "open-palette";

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
 * The fixed shortcut set (see D8 in the Step 5 spec). `"open-palette"` has
 * two rows - `⌘K`/`Ctrl+K` and `/` - since either opens the palette.
 */
export const SHORTCUTS: readonly ShortcutDefinition[] = [
  { keys: ["⌘", "K"], action: "open-palette", label: "Open navigation palette" },
  { keys: ["/"], action: "open-palette", label: "Open navigation palette" },
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
 * a base key. `⌘K`/`Ctrl+K` is checked first and matches even while typing -
 * the modifier already makes it unambiguous, unlike a bare key a user might
 * legitimately want to type into a field. Every other shortcut, including
 * `/`, is suppressed while `target` is a typing target (see
 * `isTypingTarget`).
 */
export function matchShortcut(event: ShortcutEvent, target: ShortcutTarget | null): ShortcutAction | null {
  if (event.altKey) {
    return null;
  }

  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
    return "open-palette";
  }

  if (event.metaKey || event.ctrlKey) {
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
    case "/":
      return "open-palette";
    default:
      return null;
  }
}
