import Link from "next/link";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowUpRight01Icon } from "@hugeicons/core-free-icons";
import type { ReactNode } from "react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { iconFor } from "@/lib/doc-components/icons";
import type { IconName } from "@/lib/doc-components/icons";

/** Matches the external-link test `InlineLink` uses in
 * `markdown-nodes.tsx`, so a card and an ordinary markdown link agree on
 * what counts as "external" - one absolute-URL regex, not two. */
const EXTERNAL_URL_PATTERN = /^https?:\/\//;

const COLUMN_CLASSES: Record<1 | 2 | 3, string> = {
  1: "grid-cols-1",
  2: "grid-cols-1 sm:grid-cols-2",
  3: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
};

/**
 * `::::cards{columns}` - a responsive grid wrapper around `:::card`
 * children. `columns` is a maximum, not a fixed count (T9's own framing):
 * the grid always collapses to one column below `sm`, so a 3-column grid
 * on desktop is never forced to stay 3-wide on a phone.
 *
 * A Server Component: purely layout, nothing interactive.
 */
export function CardsGrid({ columns = 3, children }: { columns?: 1 | 2 | 3; children?: ReactNode }) {
  return <div className={cn("grid gap-4", COLUMN_CLASSES[columns])}>{children}</div>;
}

function CardBody({
  title,
  icon,
  isExternal,
  children,
}: {
  title?: string;
  icon?: IconName;
  isExternal: boolean;
  children?: ReactNode;
}) {
  return (
    <Card className="h-full">
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          {icon !== undefined && (
            <span className="flex size-9 items-center justify-center rounded-lg bg-muted text-foreground">
              <HugeiconsIcon icon={iconFor(icon)} strokeWidth={2} className="size-4.5" />
            </span>
          )}
          {isExternal && (
            <HugeiconsIcon
              icon={ArrowUpRight01Icon}
              strokeWidth={2}
              className="size-4 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
            />
          )}
        </div>
        {title !== undefined && <CardTitle>{title}</CardTitle>}
      </CardHeader>
      {children !== undefined && (
        <CardContent>
          <CardDescription>{children}</CardDescription>
        </CardContent>
      )}
    </Card>
  );
}

/**
 * `:::card{title icon href}` - a documentation, guide, or resource card
 * (Claude.md's Cards section). With no `href` it's static; with one, the
 * whole card becomes a link with a hover lift and, for an absolute URL, an
 * external-link affordance (an arrow icon plus `target="_blank"` -
 * matching `InlineLink`'s own external test, so a reader can't get an
 * absolute link that silently navigates away without warning).
 *
 * A Server Component: the hover lift is pure CSS, nothing here holds
 * state.
 *
 * @example
 * ```md
 * :::card{title="Quick Start" icon=rocket href="/docs/quick-start"}
 * Get an agent running in five minutes.
 * :::
 * ```
 */
export function DocCard({
  title,
  icon,
  href,
  children,
}: {
  title?: string;
  icon?: IconName;
  href?: string;
  children?: ReactNode;
}) {
  const isExternal = href !== undefined && EXTERNAL_URL_PATTERN.test(href);
  const body = (
    <CardBody title={title} icon={icon} isExternal={isExternal}>
      {children}
    </CardBody>
  );

  if (href === undefined) {
    return <div className="h-full">{body}</div>;
  }

  const linkClassName = "group block h-full transition-transform duration-200 hover:-translate-y-1";

  if (isExternal) {
    return (
      <a href={href} target="_blank" rel="noreferrer noopener" className={linkClassName}>
        {body}
      </a>
    );
  }

  return (
    <Link href={href} className={linkClassName}>
      {body}
    </Link>
  );
}
