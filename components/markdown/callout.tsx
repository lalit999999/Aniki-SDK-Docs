/**
 * Renders the shared hast contract both `remark-admonitions` (GitHub
 * alert blockquotes) and `remark-callouts` (`:::directive` containers)
 * produce (D12): `<aside data-callout="…" data-callout-title="…">`.
 * One component for both syntaxes, since authors and readers shouldn't
 * need to care which one produced a given block.
 */

import type { ReactNode } from "react";

import { cn } from "@/lib/utils";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  AlertCircleIcon,
  Alert02Icon,
  FireIcon,
  IdeaIcon,
  InformationCircleIcon,
} from "@hugeicons/core-free-icons";
import type { CalloutKind } from "@/lib/markdown";

interface CalloutStyle {
  icon: typeof InformationCircleIcon;
  container: string;
  iconClassName: string;
}

const CALLOUT_STYLES: Record<CalloutKind, CalloutStyle> = {
  note: {
    icon: InformationCircleIcon,
    container: "border-primary/30 bg-primary/5",
    iconClassName: "text-primary",
  },
  tip: {
    icon: IdeaIcon,
    container: "border-chart-2/40 bg-chart-2/10",
    iconClassName: "text-chart-2",
  },
  important: {
    icon: Alert02Icon,
    container: "border-chart-4/40 bg-chart-4/10",
    iconClassName: "text-chart-4",
  },
  warning: {
    icon: AlertCircleIcon,
    container: "border-chart-3/40 bg-chart-3/10",
    iconClassName: "text-chart-3",
  },
  caution: {
    icon: FireIcon,
    container: "border-destructive/40 bg-destructive/10",
    iconClassName: "text-destructive",
  },
};

const KNOWN_KINDS = new Set<string>(Object.keys(CALLOUT_STYLES));

interface CalloutProps {
  children?: ReactNode;
  "data-callout"?: string;
  "data-callout-title"?: string;
}

export function Callout({
  children,
  "data-callout": kindAttr,
  "data-callout-title": title,
}: CalloutProps) {
  const kind: CalloutKind = kindAttr !== undefined && KNOWN_KINDS.has(kindAttr) ? (kindAttr as CalloutKind) : "note";
  const style = CALLOUT_STYLES[kind];

  return (
    <aside
      className={cn(
        "my-6 flex gap-3 rounded-lg border px-4 py-3 text-sm leading-relaxed",
        style.container,
      )}
    >
      <HugeiconsIcon
        icon={style.icon}
        size={20}
        strokeWidth={2}
        className={cn("mt-0.5 shrink-0", style.iconClassName)}
        aria-hidden="true"
      />
      <div className="min-w-0 flex-1 text-foreground [&>p]:my-0 [&>p:not(:last-child)]:mb-2">
        {title !== undefined && title.length > 0 && (
          <p className="mb-1 font-semibold text-foreground">{title}</p>
        )}
        {children}
      </div>
    </aside>
  );
}
