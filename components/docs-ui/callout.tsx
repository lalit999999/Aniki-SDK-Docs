import { HugeiconsIcon } from "@hugeicons/react";
import type { IconSvgElement } from "@hugeicons/react";
import {
  Alert01Icon,
  AlertDiamondIcon,
  CheckmarkCircle02Icon,
  Idea01Icon,
  InformationCircleIcon,
} from "@hugeicons/core-free-icons";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/** The six required callout types (Claude.md's Callouts section) - also
 * the six directive aliases `lib/doc-components/registry.ts` registers
 * alongside the base `:::callout{type=...}` form. */
export const CALLOUT_TYPES = ["note", "tip", "warning", "danger", "success", "info"] as const;
export type CalloutType = (typeof CALLOUT_TYPES)[number];

/**
 * Per-type icon, default title, and tone. This theme (`radix-luma`, base
 * colour `olive`) has no distinct hue per semantic type - `--chart-1..5`
 * is a lightness ramp, not a qualitative palette - so type is conveyed by
 * icon and label first (D15: meaning must never rest on colour alone),
 * with only a two-tier colour distinction: `destructive` for the two
 * types that warn of a problem, the neutral border/primary tokens for the
 * rest.
 */
const CALLOUT_CONFIG: Record<
  CalloutType,
  { icon: IconSvgElement; defaultTitle: string; tone: "neutral" | "destructive" }
> = {
  note: { icon: InformationCircleIcon, defaultTitle: "Note", tone: "neutral" },
  info: { icon: InformationCircleIcon, defaultTitle: "Info", tone: "neutral" },
  tip: { icon: Idea01Icon, defaultTitle: "Tip", tone: "neutral" },
  success: { icon: CheckmarkCircle02Icon, defaultTitle: "Success", tone: "neutral" },
  warning: { icon: Alert01Icon, defaultTitle: "Warning", tone: "destructive" },
  danger: { icon: AlertDiamondIcon, defaultTitle: "Danger", tone: "destructive" },
};

const TONE_CLASSES: Record<"neutral" | "destructive", string> = {
  neutral: "border-primary/40 bg-muted/40 text-foreground [&_svg]:text-foreground",
  destructive: "border-destructive/60 bg-destructive/5 text-foreground [&_svg]:text-destructive",
};

/**
 * An informational callout - `:::callout{type=warning}` or, equivalently
 * and more commonly, one of the six aliased forms (`:::warning`). Renders
 * as a bordered, tinted block with an icon and a title, matching Claude.md's
 * Callouts requirements (icon, title, coloured border, background, dark
 * mode).
 *
 * A Server Component - a callout has no interactive state of its own.
 *
 * @example
 * ```md
 * :::warning[Careful]
 * This action can't be undone.
 * :::
 * ```
 */
export function Callout({
  type,
  title,
  children,
}: {
  type: CalloutType;
  /** Overrides the type's default title (`"Note"`, `"Tip"`, ...). Comes
   * from the `title` attribute or the D8 directive label - whichever the
   * registry entry supplies. */
  title?: string;
  children?: ReactNode;
}) {
  const config = CALLOUT_CONFIG[type];
  const resolvedTitle = title ?? config.defaultTitle;

  return (
    <div
      role="note"
      className={cn(
        "flex gap-3 rounded-lg border-l-4 border border-border/60 px-4 py-3",
        TONE_CLASSES[config.tone],
      )}
    >
      <HugeiconsIcon icon={config.icon} strokeWidth={2} className="mt-0.5 size-4 shrink-0" />
      <div className="flex-1 space-y-1 text-sm [&>:last-child]:mb-0">
        <p className="font-medium">{resolvedTitle}</p>
        {children}
      </div>
    </div>
  );
}
