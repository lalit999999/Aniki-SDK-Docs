import type { IconSvgElement } from "@hugeicons/react";
import { HugeiconsIcon } from "@hugeicons/react";

import { Card, CardContent } from "@/components/ui/card";

/**
 * A single dashboard metric tile: label, value, icon, and an optional
 * one-line detail. Purely presentational - `app/admin/page.tsx` computes
 * every value from live content and passes it in, so this component never
 * fetches anything itself and stays trivially reusable for any future
 * stat.
 *
 * @example
 * ```tsx
 * <StatCard label="Total documents" value={42} icon={File01Icon} />
 * ```
 */
export function StatCard({
  label,
  value,
  icon,
  description,
}: {
  readonly label: string;
  readonly value: string | number;
  readonly icon: IconSvgElement;
  readonly description?: string;
}) {
  return (
    <Card size="sm">
      <CardContent className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-1">
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="truncate font-heading text-2xl font-semibold text-foreground">{value}</p>
          {description !== undefined && <p className="truncate text-xs text-muted-foreground">{description}</p>}
        </div>
        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-muted text-foreground">
          <HugeiconsIcon icon={icon} strokeWidth={2} className="size-5" />
        </span>
      </CardContent>
    </Card>
  );
}
