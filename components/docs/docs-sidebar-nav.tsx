"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowDown01Icon } from "@hugeicons/core-free-icons";

import { cn } from "@/lib/utils";
import { useMediaQuery } from "@/hooks/use-media-query";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import type { DocCategory, DocNavCategory } from "@/lib/content";

/**
 * Renders the documentation nav tree grouped by category. This is the one
 * client leaf that knows the current route.
 *
 * A category's open state is derived every render from the current
 * pathname - `overrides.get(category) ?? categoryContainsPathname` - rather
 * than read once via `defaultOpen`. The sidebar component is never
 * remounted during client-side navigation, so a `defaultOpen` read at
 * mount would leave whichever section was active on the first page load
 * expanded (or collapsed) forever after, regardless of where the user
 * navigates to next. A user who explicitly toggles a section via
 * `onOpenChange` gets that choice layered on top through `overrides`, and
 * it persists until they navigate into a different category.
 *
 * The active link is also kept in view: after each navigation, if it sits
 * outside the nav's scroll container's visible band, the container's
 * `scrollTop` is nudged so the link lands roughly a third of the way down.
 * This scrolls only the nav's own container, never
 * `element.scrollIntoView()`, which walks and scrolls every scrollable
 * ancestor - including the page itself - and would yank the viewport when
 * the sidebar is only partly on screen.
 *
 * @param onNavigate - called after a link is clicked, so the mobile drawer
 * that wraps this component can close itself.
 */
export function DocsSidebarNav({
  nav,
  onNavigate,
}: {
  nav: DocNavCategory[];
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const [overrides, setOverrides] = useState<Map<DocCategory, boolean>>(new Map());
  const navRef = useRef<HTMLElement>(null);
  const activeLinkRef = useRef<HTMLAnchorElement>(null);
  const isFirstScroll = useRef(true);
  const reduceMotion = useMediaQuery("(prefers-reduced-motion: reduce)");

  useEffect(() => {
    const activeLink = activeLinkRef.current;
    const container = navRef.current?.parentElement;
    if (activeLink === null || container === null || container === undefined) {
      return;
    }

    const containerRect = container.getBoundingClientRect();
    const linkRect = activeLink.getBoundingClientRect();
    const isVisible = linkRect.top >= containerRect.top && linkRect.bottom <= containerRect.bottom;

    if (!isVisible) {
      const offsetWithinContainer = linkRect.top - containerRect.top + container.scrollTop;
      const target = Math.max(offsetWithinContainer - container.clientHeight / 3, 0);
      const behavior = isFirstScroll.current || reduceMotion ? "auto" : "smooth";
      container.scrollTo({ top: target, behavior });
    }

    isFirstScroll.current = false;
  }, [pathname, reduceMotion]);

  return (
    <nav ref={navRef} aria-label="Documentation" className="flex flex-col gap-4 text-sm">
      {nav.map((section) => {
        const categoryContainsPathname = section.docs.some((doc) => doc.route === pathname);
        const isOpen = overrides.get(section.category) ?? categoryContainsPathname;

        return (
          <Collapsible
            key={section.category}
            open={isOpen}
            onOpenChange={(open) => {
              setOverrides((previous) => new Map(previous).set(section.category, open));
            }}
          >
            <CollapsibleTrigger className="group/trigger flex w-full items-center justify-between rounded-md px-2 py-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase outline-none focus-visible:ring-3 focus-visible:ring-ring/30">
              {section.category}
              <HugeiconsIcon
                icon={ArrowDown01Icon}
                strokeWidth={2}
                className="size-3.5 transition-transform group-aria-expanded/trigger:rotate-180"
              />
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-1 flex flex-col gap-0.5">
              {section.docs.map((doc) => {
                const isActive = doc.route === pathname;
                return (
                  <Link
                    key={doc.slug}
                    ref={isActive ? activeLinkRef : undefined}
                    href={doc.route}
                    aria-current={isActive ? "page" : undefined}
                    onClick={onNavigate}
                    className={cn(
                      "relative rounded-md px-3 py-1.5 text-muted-foreground transition-colors outline-none hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/30",
                      isActive &&
                        "bg-muted font-medium text-foreground before:absolute before:inset-y-1 before:left-0 before:w-0.5 before:rounded-full before:bg-primary",
                    )}
                  >
                    {doc.title}
                  </Link>
                );
              })}
            </CollapsibleContent>
          </Collapsible>
        );
      })}
    </nav>
  );
}
