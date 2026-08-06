import Link from "next/link";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowLeft01Icon, ArrowRight01Icon } from "@hugeicons/core-free-icons";

import { cn } from "@/lib/utils";

/**
 * The minimum shape `PreviousNextNav` needs from an adjacent item: a route
 * to link to and a title to show. `category` is optional and, when
 * present, is used as the eyebrow label above the title - the behaviour
 * `DocMeta` already relied on. Items with no `category` (release notes)
 * fall back to the `olderLabel`/`newerLabel` props instead.
 */
interface PreviousNextItem {
  route: string;
  title: string;
  category?: string;
}

/**
 * Previous/next cards, generalized (D16 in the sub-task 9 spec) over any
 * item with a `route` and `title` - documentation pages (crossing category
 * boundaries, labelled by `category`) and release notes (labelled by
 * `olderLabel`/`newerLabel`) alike. Renders only the sides that exist so
 * the grid stays balanced at the start and end of the sequence (the
 * remaining card spans the full width via `col-span-2` on the lone
 * child).
 *
 * Chose to generalize this component rather than write a parallel
 * `ReleaseNav` (D16): the markup, spacing, and hover behaviour would
 * otherwise be duplicated verbatim for a difference that's really just
 * "where does the eyebrow label come from." The existing docs call site
 * (`<PreviousNextNav adjacent={adjacent} />`) needs no changes - `category`
 * keeps working exactly as before, and the new props are optional.
 */
export function PreviousNextNav<T extends PreviousNextItem>({
  adjacent,
  olderLabel,
  newerLabel,
}: {
  adjacent: { previous: T | null; next: T | null };
  /** Eyebrow label for the previous card when the item has no `category`
   * of its own. */
  olderLabel?: string;
  /** Eyebrow label for the next card when the item has no `category` of
   * its own. */
  newerLabel?: string;
}) {
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
            {previous.category ?? olderLabel}
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
            {next.category ?? newerLabel}
            <HugeiconsIcon icon={ArrowRight01Icon} strokeWidth={2} className="size-3.5" />
          </span>
          <span className="font-medium text-foreground group-hover:underline">{next.title}</span>
        </Link>
      )}
    </nav>
  );
}
