"use client";

import { HugeiconsIcon } from "@hugeicons/react";
import { Search01Icon } from "@hugeicons/core-free-icons";

import { Button } from "@/components/ui/button";
import { Kbd, KbdGroup } from "@/components/ui/kbd";
import { useMounted } from "@/hooks/use-mounted";
import { useNavigationUi } from "@/components/docs/navigation-provider";

/**
 * Opens the ⌘K navigation palette. Replaces the header's old disabled
 * "Coming soon" search placeholder now that the feature is real - no
 * `Tooltip` wrapper or `disabled`/`aria-disabled` attributes needed.
 *
 * The chord shown differs by platform (`⌘K` on Apple devices, `Ctrl K`
 * elsewhere), read from `navigator.userAgent` only after mount via
 * `useMounted` so the server-rendered markup and the first client render
 * agree - there is no platform to read during SSR, so the server (and
 * first client paint) always renders the `Ctrl` form.
 */
export function PaletteTrigger() {
  const { openPalette } = useNavigationUi();
  const mounted = useMounted();
  const isApple = mounted && /Mac|iPhone|iPad|iPod/.test(window.navigator.userAgent);

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={openPalette}
      aria-label="Open navigation palette"
      className="gap-2 text-muted-foreground"
    >
      <HugeiconsIcon icon={Search01Icon} strokeWidth={2} />
      <span className="hidden sm:inline">Search</span>
      <KbdGroup className="hidden sm:inline-flex">
        {isApple ? (
          <Kbd>⌘K</Kbd>
        ) : (
          <>
            <Kbd>Ctrl</Kbd>
            <Kbd>K</Kbd>
          </>
        )}
      </KbdGroup>
    </Button>
  );
}
