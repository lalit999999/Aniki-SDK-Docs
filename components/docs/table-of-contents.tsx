"use client";

import { useMemo } from "react";

import { cn } from "@/lib/utils";
import { useActiveHeading } from "@/hooks/use-active-heading";
// Imported directly from the submodule, not the `server-only`-guarded
// `@/lib/content` barrel: `flattenToc` is a pure function with no
// filesystem access, and this component runs on the client.
import { flattenToc } from "@/lib/content/toc";
import type { TocNode } from "@/lib/content/types";

/**
 * Right-hand "on this page" navigation, rendered from a document's nested
 * H2-H4 heading tree. Independently scrollable and height-bounded (never
 * stretches the page or pushes the footer down - this matters most on
 * `api-reference`, which has 108 entries) and hidden below `xl`, where the
 * three-column grid collapses to two.
 */
export function TableOfContents({ toc }: { toc: TocNode[] }) {
  const flat = useMemo(() => flattenToc(toc), [toc]);
  const ids = useMemo(() => flat.map((heading) => heading.id), [flat]);
  const activeId = useActiveHeading(ids);

  if (toc.length === 0) {
    return null;
  }

  return (
    <aside
      aria-label="On this page"
      className="sticky top-[calc(var(--header-height)+2rem)] hidden h-[calc(100svh-var(--header-height)-4rem)] shrink-0 overflow-y-auto py-8 pl-6 text-sm xl:block"
    >
      <p className="mb-3 text-xs font-semibold tracking-wide text-muted-foreground uppercase">On this page</p>
      <TocList nodes={toc} activeId={activeId} />
    </aside>
  );
}

function TocList({ nodes, activeId }: { nodes: TocNode[]; activeId: string | null }) {
  return (
    <ul className="flex flex-col gap-1.5 border-l border-border">
      {nodes.map((node) => {
        const isActive = node.id === activeId;
        return (
          <li key={node.id} style={{ paddingLeft: `${(node.level - 2) * 0.75 + 0.75}rem` }}>
            <a
              href={`#${node.id}`}
              aria-current={isActive ? "location" : undefined}
              className={cn(
                "-ml-px block border-l pl-3 text-muted-foreground transition-colors hover:text-foreground",
                isActive ? "border-l-primary font-medium text-foreground" : "border-l-transparent",
              )}
            >
              {node.text}
            </a>
            {node.children.length > 0 && <TocList nodes={node.children} activeId={activeId} />}
          </li>
        );
      })}
    </ul>
  );
}
