"use client";

/**
 * Copies a code block's raw source to the clipboard.
 *
 * `navigator.clipboard` is `undefined` in insecure contexts (plain HTTP,
 * origins other than `localhost`) - guarded rather than assumed, since a
 * thrown `TypeError` from calling a method on `undefined` would otherwise
 * surface as an unhandled promise rejection with no user feedback.
 */

import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";
import { HugeiconsIcon } from "@hugeicons/react";
import { Cancel01Icon, Copy01Icon, Tick02Icon } from "@hugeicons/core-free-icons";

type CopyState = "idle" | "copied" | "error";

const RESET_DELAY_MS = 2000;

export function CopyButton({ code }: { code: string }) {
  const [state, setState] = useState<CopyState>("idle");
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current !== null) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  function scheduleReset(): void {
    if (timeoutRef.current !== null) {
      clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = setTimeout(() => setState("idle"), RESET_DELAY_MS);
  }

  async function handleClick(): Promise<void> {
    if (typeof navigator === "undefined" || navigator.clipboard === undefined) {
      setState("error");
      scheduleReset();
      return;
    }

    try {
      await navigator.clipboard.writeText(code);
      setState("copied");
    } catch {
      setState("error");
    }
    scheduleReset();
  }

  const icon = state === "copied" ? Tick02Icon : state === "error" ? Cancel01Icon : Copy01Icon;
  const liveMessage = state === "copied" ? "Copied" : state === "error" ? "Copy failed" : "";

  return (
    <>
      <button
        type="button"
        onClick={() => void handleClick()}
        aria-label="Copy code"
        className={cn(
          "inline-flex size-7 shrink-0 items-center justify-center rounded-md border border-transparent text-muted-foreground transition-colors",
          "hover:border-border hover:bg-muted hover:text-foreground",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          state === "copied" && "text-primary",
          state === "error" && "text-destructive",
        )}
      >
        <HugeiconsIcon icon={icon} size={14} strokeWidth={2} />
      </button>
      <span aria-live="polite" className="sr-only">
        {liveMessage}
      </span>
    </>
  );
}
