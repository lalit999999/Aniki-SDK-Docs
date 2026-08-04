import Link from "next/link";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowLeft01Icon, ArrowRight01Icon } from "@hugeicons/core-free-icons";

import { cn } from "@/lib/utils";
import type { AdjacentDocs } from "@/lib/content";

/**
 * Previous/next document cards, crossing category boundaries. Renders
 * only the sides that exist so the grid stays balanced at the start and
 * end of the document set (the remaining card spans the full width via
 * `col-span-2` on the lone child).
 */
export function PreviousNextNav({ adjacent }: { adjacent: AdjacentDocs }) {
  const { previous, next } = adjacent;
  if (previous === null && next === null) {
    return null;
  }

  const single = previous === null || next === null;

  return (
    <nav aria-label="Pagination" className="grid gap-4 sm:grid-cols-2">
      {previous !== null && (
        <Link
          href={previous.route}
          className={cn(
            "group flex flex-col gap-1 rounded-lg border border-border p-4 transition-colors hover:bg-muted",
            single && "sm:col-span-2",
          )}
        >
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <HugeiconsIcon icon={ArrowLeft01Icon} strokeWidth={2} className="size-3.5" />
            {previous.category}
          </span>
          <span className="font-medium text-foreground group-hover:underline">{previous.title}</span>
        </Link>
      )}
      {next !== null && (
        <Link
          href={next.route}
          className={cn(
            "group flex flex-col items-end gap-1 rounded-lg border border-border p-4 text-right transition-colors hover:bg-muted",
            single && "sm:col-span-2",
          )}
        >
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            {next.category}
            <HugeiconsIcon icon={ArrowRight01Icon} strokeWidth={2} className="size-3.5" />
          </span>
          <span className="font-medium text-foreground group-hover:underline">{next.title}</span>
        </Link>
      )}
    </nav>
  );
}
