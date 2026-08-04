"use client";

import { useEffect } from "react";

import { matchShortcut } from "@/lib/navigation/shortcuts";
import type { ShortcutAction, ShortcutTarget } from "@/lib/navigation/shortcuts";

/** One handler per action a caller wants to respond to. An action with no
 * handler is simply ignored if matched. */
export type ShortcutHandlers = Partial<Record<ShortcutAction, () => void>>;

/**
 * Installs a single global `keydown` listener that translates a real
 * `KeyboardEvent` into the plain shapes `matchShortcut` accepts and
 * dispatches the result to `handlers`. All the "was the user typing" and
 * "which modifiers were held" logic lives in that pure matcher - this hook
 * only wires it up to the DOM and calls `preventDefault()` on a match, so
 * the shortcut doesn't also perform its browser-default behaviour (`/`
 * triggering Firefox's quick-find, for instance).
 *
 * @param enabled - when `false` the listener isn't installed at all, so an
 * open overlay can suspend the whole layer rather than each caller having
 * to guard its own handlers.
 */
export function useKeyboardShortcuts(handlers: ShortcutHandlers, enabled: boolean): void {
  useEffect(() => {
    if (!enabled) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      const target: ShortcutTarget | null =
        event.target instanceof HTMLElement
          ? { tagName: event.target.tagName, isContentEditable: event.target.isContentEditable }
          : null;

      const action = matchShortcut(
        {
          key: event.key,
          metaKey: event.metaKey,
          ctrlKey: event.ctrlKey,
          altKey: event.altKey,
          shiftKey: event.shiftKey,
        },
        target,
      );

      if (action === null) {
        return;
      }

      event.preventDefault();
      handlers[action]?.();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handlers, enabled]);
}
