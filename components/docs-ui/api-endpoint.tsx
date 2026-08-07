import { HugeiconsIcon } from "@hugeicons/react";
import { Alert01Icon, Shield01Icon } from "@hugeicons/core-free-icons";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

import { CopyButton } from "./copy-button";

/** The HTTP methods `:::api-endpoint` accepts - `lib/doc-components/registry.ts`
 * uppercases the authored `method` attribute before validating it against
 * this list, so `method=get` and `method=GET` both resolve. */
export const HTTP_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"] as const;
export type HttpMethod = (typeof HTTP_METHODS)[number];

/**
 * Per-method accent. This theme's own tokens (`--chart-1..5`) are a
 * lightness ramp, not a qualitative palette (see `Callout`'s identical
 * note), so a *consistent* per-method colour - the grammar's own
 * requirement - has to come from Tailwind's stock colour scale instead of
 * a site token. The method still renders as text inside the badge either
 * way (D15): colour is a secondary cue here, never the only one.
 */
const METHOD_STYLES: Record<HttpMethod, string> = {
  GET: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  POST: "border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-400",
  PUT: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400",
  PATCH: "border-violet-500/30 bg-violet-500/10 text-violet-700 dark:text-violet-400",
  DELETE: "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-400",
  HEAD: "border-slate-500/30 bg-slate-500/10 text-slate-700 dark:text-slate-400",
  OPTIONS: "border-slate-500/30 bg-slate-500/10 text-slate-700 dark:text-slate-400",
};

/**
 * An API reference card - `:::api-endpoint{method path auth deprecated}` -
 * with a method badge, a copyable monospace path, optional auth/deprecated
 * badges, and the directive body as its description.
 *
 * A Server Component: `CopyButton` is the only interactive piece, composed
 * in rather than pulling the whole card behind a client boundary (D10).
 *
 * @example
 * ```md
 * :::api-endpoint{method=GET path="/v1/agents" auth}
 * Lists every agent in the current workspace.
 * :::
 * ```
 */
export function ApiEndpoint({
  method,
  path,
  auth,
  deprecated,
  children,
}: {
  method: HttpMethod;
  path: string;
  auth?: boolean;
  deprecated?: boolean;
  children?: ReactNode;
}) {
  return (
    <div className="my-4 overflow-hidden rounded-lg border border-border">
      <div className="flex flex-wrap items-center gap-2 border-b border-border bg-muted/40 px-4 py-3">
        <span
          className={cn(
            "inline-flex shrink-0 items-center rounded-md border px-2 py-0.5 font-mono text-xs font-bold tracking-wide",
            METHOD_STYLES[method],
          )}
        >
          {method}
        </span>
        <code className="min-w-0 flex-1 truncate font-mono text-sm text-foreground">{path}</code>
        <CopyButton text={path} label="Copy endpoint path" />
        {deprecated === true && (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-md border border-destructive/30 bg-destructive/5 px-2 py-0.5 text-xs font-medium text-destructive">
            <HugeiconsIcon icon={Alert01Icon} strokeWidth={2} className="size-3" />
            Deprecated
          </span>
        )}
        {auth === true && (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-md border border-border bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
            <HugeiconsIcon icon={Shield01Icon} strokeWidth={2} className="size-3" />
            Auth required
          </span>
        )}
      </div>
      {children !== undefined && (
        <div className="px-4 py-3 text-sm text-muted-foreground [&>:last-child]:mb-0">{children}</div>
      )}
    </div>
  );
}
