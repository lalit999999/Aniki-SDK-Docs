/**
 * Renders hast `a` elements produced by `rehype-doc-links` (D13).
 *
 * The link-rewriting plugin never sets `target`/`rel` itself for internal
 * links - this component decides rendering strategy purely from `href`
 * shape and the `data-external`/`data-unresolved` markers, rather than
 * trusting attributes the plugin may or may not have set.
 */

import Link from "next/link";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowUpRight01Icon } from "@hugeicons/core-free-icons";

interface MarkdownLinkProps {
  href?: string;
  children?: ReactNode;
  "data-external"?: string;
  "data-unresolved"?: string;
}

const BASE_LINK_CLASSNAME =
  "font-medium text-primary underline decoration-primary/40 underline-offset-4 transition-colors hover:decoration-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";

export function MarkdownLink({
  href,
  children,
  "data-external": isExternal,
  "data-unresolved": isUnresolved,
}: MarkdownLinkProps) {
  if (href === undefined) {
    return <span>{children}</span>;
  }

  if (isExternal !== undefined) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={cn(BASE_LINK_CLASSNAME, "inline-flex items-center gap-0.5")}
      >
        {children}
        <HugeiconsIcon icon={ArrowUpRight01Icon} size={14} strokeWidth={2} aria-hidden="true" />
        <span className="sr-only"> (opens in a new tab)</span>
      </a>
    );
  }

  if (isUnresolved !== undefined) {
    return (
      <a
        href={href}
        className={cn(BASE_LINK_CLASSNAME, "decoration-dashed decoration-muted-foreground/70")}
      >
        {children}
      </a>
    );
  }

  return (
    <Link href={href} className={BASE_LINK_CLASSNAME}>
      {children}
    </Link>
  );
}
