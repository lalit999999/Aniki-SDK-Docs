"use client";

import { useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowDown01Icon } from "@hugeicons/core-free-icons";

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
// Imported directly from the submodule, not the `server-only`-guarded
// `@/lib/content` barrel: `flattenToc` is a pure function with no
// filesystem access, and this component runs on the client.
import { flattenToc } from "@/lib/content/toc";
import type { TocNode } from "@/lib/content/types";

/**
 * "On this page" as a collapsed-by-default drawer for viewports below
 * `xl`, where the sticky sidebar `TableOfContents` is hidden - the only
 * path to jumping directly to a section on small and medium viewports.
 * Renders the heading tree flattened into a single indented list rather
 * than the sidebar's nested `<ul>` structure, since this is meant to be
 * scanned quickly and dismissed, not lingered in.
 */
export function MobileToc({ toc }: { toc: TocNode[] }) {
  const [open, setOpen] = useState(false);
  const headings = flattenToc(toc);

  if (headings.length === 0) {
    return null;
  }

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="mb-6 xl:hidden">
      <CollapsibleTrigger className="group/trigger flex w-full items-center justify-between rounded-md border border-border px-3 py-2 text-sm font-medium text-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/30">
        On this page
        <HugeiconsIcon
          icon={ArrowDown01Icon}
          strokeWidth={2}
          className="size-3.5 transition-transform group-aria-expanded/trigger:rotate-180"
        />
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-2 flex flex-col gap-1 border-l border-border pl-3 text-sm">
        {headings.map((heading) => (
          <a
            key={heading.id}
            href={`#${heading.id}`}
            onClick={() => setOpen(false)}
            style={{ paddingLeft: `${(heading.level - 2) * 0.75}rem` }}
            className="rounded px-2 py-1 text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/30"
          >
            {heading.text}
          </a>
        ))}
      </CollapsibleContent>
    </Collapsible>
  );
}
