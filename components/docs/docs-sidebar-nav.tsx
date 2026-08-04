"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowDown01Icon } from "@hugeicons/core-free-icons";

import { cn } from "@/lib/utils";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import type { DocNavCategory } from "@/lib/content";

/**
 * Renders the documentation nav tree grouped by category. This is the one
 * client leaf that knows the current route - the group containing the
 * active page starts expanded, and the active link gets `aria-current`
 * plus an accent rail. All content comes from `nav`; nothing here is
 * hardcoded per-page.
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

  return (
    <nav aria-label="Documentation" className="flex flex-col gap-4 text-sm">
      {nav.map((section) => {
        return (
          <Collapsible key={section.category} defaultOpen>
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
