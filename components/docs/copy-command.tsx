"use client";

import { useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { CheckmarkCircle01Icon, Copy01Icon } from "@hugeicons/core-free-icons";

/**
 * A one-line "npm install ..." command with a copy button. Degrades
 * gracefully (shows a failed state rather than silently doing nothing)
 * when the Clipboard API isn't available.
 */
export function CopyCommand({ command }: { command: string }) {
  const [status, setStatus] = useState<"idle" | "copied" | "failed">("idle");

  async function copy() {
    try {
      if (!navigator.clipboard) {
        throw new Error("Clipboard API unavailable");
      }
      await navigator.clipboard.writeText(command);
      setStatus("copied");
    } catch {
      setStatus("failed");
    } finally {
      setTimeout(() => setStatus("idle"), 2000);
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      className="group flex items-center gap-3 rounded-lg border border-border bg-muted px-4 py-2.5 font-mono text-sm text-foreground transition-colors hover:bg-muted/70"
    >
      <span>{command}</span>
      <span aria-live="polite" className="flex items-center gap-1 text-muted-foreground">
        {status === "copied" ? (
          <HugeiconsIcon icon={CheckmarkCircle01Icon} strokeWidth={2} className="size-4" />
        ) : (
          <HugeiconsIcon icon={Copy01Icon} strokeWidth={2} className="size-4" />
        )}
        <span className="sr-only">
          {status === "copied" ? "Copied" : status === "failed" ? "Copy failed" : "Copy to clipboard"}
        </span>
      </span>
    </button>
  );
}
