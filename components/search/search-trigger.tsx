"use client";

import { HugeiconsIcon } from "@hugeicons/react";
import { Search01Icon } from "@hugeicons/core-free-icons";

import { Button } from "@/components/ui/button";
import { Kbd, KbdGroup } from "@/components/ui/kbd";
import { useSearch } from "@/components/search/search-provider";
import { useMounted } from "@/hooks/use-mounted";

/**
 * Opens the search palette. Renders as a search-input-shaped button from
 * `sm` up (so the header reads as "here's where you search," not just an
 * icon), collapsing to a plain icon button below it for space.
 *
 * The `⌘K`/`Ctrl K` chord label depends on platform, which is unknowable
 * during SSR - `useMounted` defers reading `navigator.userAgent` until
 * after hydration (T5) so the server-rendered markup and the first client
 * render agree; the server (and first paint) always renders the `Ctrl`
 * form.
 */
export function SearchTrigger() {
  const { openSearch } = useSearch();
  const mounted = useMounted();
  const isApple = mounted && /Mac|iPhone|iPad|iPod/.test(window.navigator.userAgent);

  return (
    <>
      <button
        type="button"
        onClick={openSearch}
        aria-label="Search documentation"
        className="hidden w-56 items-center gap-2 rounded-md border border-border bg-muted/50 px-3 py-1.5 text-left text-sm text-muted-foreground transition-colors hover:bg-muted sm:flex"
      >
        <HugeiconsIcon icon={Search01Icon} strokeWidth={2} className="size-4 shrink-0" />
        <span className="flex-1 truncate">Search documentation…</span>
        <KbdGroup>
          {isApple ? (
            <Kbd>⌘K</Kbd>
          ) : (
            <>
              <Kbd>Ctrl</Kbd>
              <Kbd>K</Kbd>
            </>
          )}
        </KbdGroup>
      </button>

      <Button
        variant="ghost"
        size="icon"
        onClick={openSearch}
        aria-label="Search documentation"
        className="sm:hidden"
      >
        <HugeiconsIcon icon={Search01Icon} strokeWidth={2} />
      </Button>
    </>
  );
}
