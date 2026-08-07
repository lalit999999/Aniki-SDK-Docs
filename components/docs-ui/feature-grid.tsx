import { HugeiconsIcon } from "@hugeicons/react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";
import { iconFor } from "@/lib/doc-components/icons";
import type { IconName } from "@/lib/doc-components/icons";

const COLUMN_CLASSES: Record<2 | 3, string> = {
  2: "grid-cols-1 sm:grid-cols-2",
  3: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
};

/**
 * `::::features{columns}` - the denser, marketing-leaning sibling of
 * `CardsGrid` (T9's own framing), built to be reused on the future landing
 * page's Features and Why Aniki SDK sections (Claude.md), not just inside
 * documentation. That's the reason its props (and `Feature`'s) stay free
 * of docs-specific assumptions - no `href`, unlike `DocCard` - it describes
 * a capability, it doesn't link to a page. `columns` is a maximum, same as
 * `CardsGrid`: always one column below `sm`.
 *
 * A Server Component: purely layout, nothing interactive.
 */
export function FeatureGrid({ columns = 3, children }: { columns?: 2 | 3; children?: ReactNode }) {
  return <div className={cn("grid gap-8", COLUMN_CLASSES[columns])}>{children}</div>;
}

/**
 * `:::feature{title icon}` - an icon, a title, and a description (its
 * body), with no border or background of its own - denser than `DocCard`
 * on purpose, since a features section reads as one continuous grid rather
 * than a set of individually-bordered tiles.
 *
 * A Server Component: no interactive state.
 *
 * @example
 * ```md
 * :::feature{title="Multi-provider" icon=puzzle}
 * Swap OpenAI, Anthropic, or a local model without touching agent code.
 * :::
 * ```
 */
export function Feature({ title, icon, children }: { title?: string; icon?: IconName; children?: ReactNode }) {
  return (
    <div className="flex flex-col gap-3">
      {icon !== undefined && (
        <span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <HugeiconsIcon icon={iconFor(icon)} strokeWidth={2} className="size-5" />
        </span>
      )}
      {title !== undefined && <p className="font-heading text-base font-semibold text-foreground">{title}</p>}
      {children !== undefined && (
        <div className="text-sm text-muted-foreground [&>:last-child]:mb-0">{children}</div>
      )}
    </div>
  );
}
