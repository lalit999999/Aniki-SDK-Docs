/**
 * Server Components for GFM tables. `api-reference.md` alone has ~198
 * table rows, so the wrapping container must scroll horizontally on
 * narrow viewports rather than forcing the whole page to.
 */

import type { CSSProperties, ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * `rehypeTableAlign` (in `lib/markdown/pipeline.ts`) rewrites GFM's
 * `align="…"` attribute into an inline `text-align` style before this
 * component ever sees it - `align` itself is a legacy HTML attribute
 * `property-information` strips before `hast-util-to-jsx-runtime` builds
 * props, so reading `align` directly here would silently always be
 * `undefined`.
 */
type CellStyle = CSSProperties | undefined;

function alignFromStyle(style: CellStyle): "left" | "center" | "right" | undefined {
  const value = style?.textAlign;
  return value === "center" || value === "right" || value === "left" ? value : undefined;
}

export function Table({ children }: { children?: ReactNode }) {
  return (
    <div
      role="region"
      aria-label="Scrollable table"
      tabIndex={0}
      className="my-6 overflow-x-auto rounded-lg border border-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <table className="w-full min-w-[32rem] border-collapse text-sm">{children}</table>
    </div>
  );
}

export function TableHead({ children }: { children?: ReactNode }) {
  return <thead className="bg-muted/60">{children}</thead>;
}

export function TableBody({ children }: { children?: ReactNode }) {
  return <tbody className="divide-y divide-border">{children}</tbody>;
}

export function TableRow({ children }: { children?: ReactNode }) {
  return <tr className="border-b border-border last:border-0">{children}</tr>;
}

export function TableHeaderCell({ children, style }: { children?: ReactNode; style?: CellStyle }) {
  const align = alignFromStyle(style);
  return (
    <th
      className={cn(
        "border-b border-border px-4 py-2 font-semibold text-foreground",
        align === "center" && "text-center",
        align === "right" && "text-right",
        align === undefined || align === "left" ? "text-left" : undefined,
      )}
    >
      {children}
    </th>
  );
}

export function TableCell({ children, style }: { children?: ReactNode; style?: CellStyle }) {
  const align = alignFromStyle(style);
  return (
    <td
      className={cn(
        "px-4 py-2 text-muted-foreground",
        align === "center" && "text-center",
        align === "right" && "text-right",
        align === undefined || align === "left" ? "text-left" : undefined,
      )}
    >
      {children}
    </td>
  );
}
