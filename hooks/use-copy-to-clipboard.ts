"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type CopyStatus = "idle" | "copied" | "failed";

export interface UseCopyToClipboardOptions {
  /** How long `status` stays `"copied"`/`"failed"` before resetting to
   * `"idle"`. Defaults to 2000ms. */
  resetAfterMs?: number;
}

export interface UseCopyToClipboardResult {
  status: CopyStatus;
  copy: (text: string) => Promise<void>;
}

/**
 * Shared clipboard-write logic for the copy-command, copy-page-URL, and
 * copy-heading-link affordances (D12). Degrades to a `"failed"` status
 * rather than throwing when the Clipboard API is unavailable (non-secure
 * contexts) or a write is rejected (permission denied).
 *
 * Clears its reset timeout on unmount - the bug the original
 * `CopyCommand` had, where a `setTimeout` from a copy right before
 * navigation would fire `setState` on an unmounted component.
 *
 * @example
 * ```tsx
 * const { status, copy } = useCopyToClipboard();
 * <button onClick={() => copy(url)}>{status === "copied" ? "Copied" : "Copy"}</button>
 * ```
 */
export function useCopyToClipboard(options?: UseCopyToClipboardOptions): UseCopyToClipboardResult {
  const resetAfterMs = options?.resetAfterMs ?? 2000;
  const [status, setStatus] = useState<CopyStatus>("idle");
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current !== null) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const copy = useCallback(
    async (text: string) => {
      try {
        if (!navigator.clipboard) {
          throw new Error("Clipboard API unavailable");
        }
        await navigator.clipboard.writeText(text);
        setStatus("copied");
      } catch {
        setStatus("failed");
      } finally {
        if (timeoutRef.current !== null) {
          clearTimeout(timeoutRef.current);
        }
        timeoutRef.current = setTimeout(() => {
          setStatus("idle");
          timeoutRef.current = null;
        }, resetAfterMs);
      }
    },
    [resetAfterMs],
  );

  return { status, copy };
}
