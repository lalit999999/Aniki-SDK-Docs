import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowUpRight01Icon, PlayCircleIcon } from "@hugeicons/core-free-icons";
import type { ReactNode } from "react";

/** The two states an unshipped playground can honestly be in - never
 * "available", since that's what shipping the real thing means. */
export const PLAYGROUND_STATUSES = ["coming-soon", "beta"] as const;
export type PlaygroundStatus = (typeof PLAYGROUND_STATUSES)[number];

const STATUS_LABEL: Record<PlaygroundStatus, string> = {
  "coming-soon": "Coming soon",
  beta: "Beta",
};

/**
 * The deliberate placeholder for the interactive playground listed under
 * Future Features in Claude.md - `:::playground{title status href}` marks
 * a known future capability in the docs instead of pretending it exists
 * (D5's "never crash" extended to "never lie either"): a dashed border and
 * a status badge read as intentional, not unfinished.
 *
 * Props are kept to exactly what a real embed will also need - a title, a
 * status, and an optional link out - so the real playground can replace
 * this component's internals later without a single content file needing
 * to change; only this file and its registry entry would move.
 *
 * A Server Component - nothing here is interactive beyond an ordinary
 * outbound link (D10).
 *
 * @example
 * ```md
 * :::playground{title="Streaming chat" status=beta href="https://github.com/aniki-sdk/examples"}
 * Try the streaming example in the SDK repository while the in-browser
 * playground is still being built.
 * :::
 * ```
 */
export function Playground({
  title = "Interactive Playground",
  status = "coming-soon",
  href,
  children,
}: {
  title?: string;
  status?: PlaygroundStatus;
  href?: string;
  children?: ReactNode;
}) {
  const isExternal = href !== undefined && /^https?:\/\//.test(href);

  return (
    <div className="my-4 rounded-lg border border-dashed border-border bg-muted/20 px-6 py-8 text-center">
      <div className="mx-auto flex size-10 items-center justify-center rounded-full bg-muted">
        <HugeiconsIcon icon={PlayCircleIcon} strokeWidth={2} className="size-5 text-muted-foreground" />
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
        <p className="font-heading font-semibold text-foreground">{title}</p>
        <span className="inline-flex items-center rounded-full border border-border bg-background px-2 py-0.5 text-xs font-medium text-muted-foreground">
          {STATUS_LABEL[status]}
        </span>
      </div>
      {children !== undefined && (
        <div className="mx-auto mt-2 max-w-prose text-sm text-muted-foreground [&>:last-child]:mb-0">
          {children}
        </div>
      )}
      {href !== undefined && (
        <a
          href={href}
          target={isExternal ? "_blank" : undefined}
          rel={isExternal ? "noreferrer noopener" : undefined}
          className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-primary underline underline-offset-2"
        >
          View example
          <HugeiconsIcon icon={ArrowUpRight01Icon} strokeWidth={2} className="size-3.5" />
        </a>
      )}
    </div>
  );
}
