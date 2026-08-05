"use client";

import { HugeiconsIcon } from "@hugeicons/react";
import { CheckmarkCircle01Icon, Link01Icon } from "@hugeicons/core-free-icons";

import { useCopyToClipboard } from "@/hooks/use-copy-to-clipboard";
import { siteConfig } from "@/config/site";

/**
 * A copy-link button rendered inside a content heading, revealed on
 * `group-hover` and on `:focus-visible` (a keyboard user tabbing through
 * headings must be able to reach it - hover alone would leave it
 * permanently unreachable without a mouse).
 *
 * Copies the absolute URL (`siteConfig.url` + route + hash) and updates
 * the address bar to match via `history.replaceState`, not
 * `location.hash` - setting `location.hash` directly triggers the
 * browser's native jump-to-anchor scroll, which would yank the page out
 * from under someone who is already reading that exact section.
 */
export function HeadingAnchor({ id, text, route }: { id: string; text: string; route: string }) {
  const { status, copy } = useCopyToClipboard();

  function handleClick(): void {
    void copy(`${siteConfig.url}${route}#${id}`);
    window.history.replaceState(null, "", `#${id}`);
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={`Copy link to section "${text}"`}
      className="rounded text-muted-foreground opacity-0 outline-none transition-opacity group-hover:opacity-100 focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring/50"
    >
      <HugeiconsIcon
        icon={status === "copied" ? CheckmarkCircle01Icon : Link01Icon}
        strokeWidth={2}
        className="size-4"
      />
    </button>
  );
}
