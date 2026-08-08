"use client";

import { useEffect, useRef } from "react";

/**
 * Warns before unsaved edits are lost, two ways: a native `beforeunload`
 * prompt for tab close/refresh/external navigation, and an in-app
 * `confirm()` for in-app link clicks while `dirty` - App Router has no
 * public "block this navigation" hook (unlike the Pages Router's
 * `router.events`), so this intercepts anchor clicks at the document root
 * in the capture phase, ahead of `next/link`'s own click handler, and
 * cancels the click (`stopImmediatePropagation`) if the author declines.
 * Hash-only links (`href="#..."`, e.g. a table-of-contents anchor) are
 * exempt - they don't navigate away from the page.
 *
 * Reads `dirty` through a ref, not a dependency, so the two listeners are
 * attached exactly once for the component's lifetime rather than being
 * torn down and re-attached on every keystroke.
 */
export function UnsavedChangesGuard({ dirty }: { readonly dirty: boolean }) {
  const dirtyRef = useRef(dirty);

  useEffect(() => {
    dirtyRef.current = dirty;
  }, [dirty]);

  useEffect(() => {
    function handleBeforeUnload(event: BeforeUnloadEvent): void {
      if (!dirtyRef.current) {
        return;
      }
      event.preventDefault();
      event.returnValue = "";
    }

    function handleClick(event: MouseEvent): void {
      if (!dirtyRef.current || event.defaultPrevented) {
        return;
      }
      const target = event.target;
      if (!(target instanceof Element)) {
        return;
      }
      const anchor = target.closest("a[href]");
      if (anchor === null) {
        return;
      }
      const href = anchor.getAttribute("href");
      if (href === null || href.startsWith("#")) {
        return;
      }
      const confirmed = window.confirm("You have unsaved changes. Leave this page?");
      if (!confirmed) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    }

    window.addEventListener("beforeunload", handleBeforeUnload);
    document.addEventListener("click", handleClick, true);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      document.removeEventListener("click", handleClick, true);
    };
  }, []);

  return null;
}
