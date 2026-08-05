"use client";

import { HugeiconsIcon } from "@hugeicons/react";
import { CheckmarkCircle01Icon, CopyLinkIcon } from "@hugeicons/core-free-icons";

import { useCopyToClipboard } from "@/hooks/use-copy-to-clipboard";
import { siteConfig } from "@/config/site";

/**
 * Copies the canonical, absolute URL of the current documentation page.
 * Built from `siteConfig.url` rather than `window.location` so the copied
 * link is always the production URL, even when this is clicked from a
 * local dev server or a preview deployment.
 */
export function CopyPageUrl({ route }: { route: string }) {
  const { status, copy } = useCopyToClipboard();
  const url = `${siteConfig.url}${route}`;

  return (
    <button
      type="button"
      onClick={() => copy(url)}
      className="inline-flex items-center gap-1.5 rounded-md border border-border px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
    >
      <HugeiconsIcon
        icon={status === "copied" ? CheckmarkCircle01Icon : CopyLinkIcon}
        strokeWidth={2}
        className="size-3.5"
      />
      <span aria-live="polite">
        {status === "copied" ? "Copied" : status === "failed" ? "Copy failed" : "Copy page URL"}
      </span>
    </button>
  );
}
