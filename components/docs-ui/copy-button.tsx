"use client";

import { HugeiconsIcon } from "@hugeicons/react";
import { CheckmarkCircle01Icon, Copy01Icon } from "@hugeicons/core-free-icons";

import { cn } from "@/lib/utils";
import { useCopyToClipboard } from "@/hooks/use-copy-to-clipboard";

/**
 * The one copy affordance every documentation component copies with (D11) -
 * code blocks, code groups, terminal commands, package installs, and API
 * endpoints all render this instead of hand-rolling their own clipboard
 * button. `text` is a plain string rather than a getter: every current and
 * planned caller already has the exact string to copy in hand (a code
 * block's source, a terminal's commands with prompts stripped, an
 * endpoint's path) with nothing expensive to defer.
 *
 * The only client leaf in whatever server component renders it (D10) - the
 * click handler and `useCopyToClipboard`'s local state are the entire
 * reason it needs the boundary.
 *
 * @example
 * ```tsx
 * <CopyButton text={code} label="Copy code" />
 * ```
 */
export function CopyButton({
  text,
  label = "Copy",
  className,
}: {
  /** The exact string written to the clipboard on click. */
  text: string;
  /** Accessible label, and the idle-state tooltip text. Defaults to `"Copy"`. */
  label?: string;
  className?: string;
}) {
  const { status, copy } = useCopyToClipboard();

  return (
    <button
      type="button"
      onClick={() => copy(text)}
      aria-label={label}
      className={cn(
        "inline-flex size-7 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none",
        className,
      )}
    >
      <HugeiconsIcon
        icon={status === "copied" ? CheckmarkCircle01Icon : Copy01Icon}
        strokeWidth={2}
        className="size-3.5"
      />
      <span className="sr-only" aria-live="polite">
        {status === "copied" ? "Copied" : status === "failed" ? "Copy failed" : label}
      </span>
    </button>
  );
}
