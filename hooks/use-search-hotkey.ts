"use client";

import { useEffect } from "react";

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  return (
    target.isContentEditable ||
    target.tagName === "INPUT" ||
    target.tagName === "TEXTAREA" ||
    target.tagName === "SELECT"
  );
}

/**
 * Installs a global `keydown` listener for the search palette's hotkeys:
 * `⌘K`/`Ctrl+K` and a bare `/`. Both are ignored while the event target is
 * a form field or contenteditable region (typing a literal `/` into some
 * other input on the page must not hijack it), and any combination
 * including `altKey` is ignored outright so this can never clobber an OS
 * or browser accelerator that happens to share a base key.
 *
 * `enabled` lets the caller suspend the listener entirely - `SearchProvider`
 * passes `!open`, so once the dialog is open there is exactly one active
 * listener for `/` (cmdk's own input), not two racing for the same key.
 *
 * @example
 * ```ts
 * useSearchHotkey(() => setOpen(true), !open);
 * ```
 */
export function useSearchHotkey(onTrigger: () => void, enabled: boolean = true): void {
  useEffect(() => {
    if (!enabled) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent): void {
      if (event.altKey || isTypingTarget(event.target)) {
        return;
      }

      const isModifierK = (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k";
      if (isModifierK) {
        event.preventDefault();
        onTrigger();
        return;
      }

      if (event.metaKey || event.ctrlKey) {
        return;
      }

      if (event.key === "/") {
        event.preventDefault();
        onTrigger();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onTrigger, enabled]);
}
