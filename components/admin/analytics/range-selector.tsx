import Link from "next/link";

import { cn } from "@/lib/utils";

export const ANALYTICS_RANGE_OPTIONS = [7, 30, 90] as const;
export type AnalyticsRangeDays = (typeof ANALYTICS_RANGE_OPTIONS)[number];

/**
 * Parses the `?days=` search param into one of {@link ANALYTICS_RANGE_OPTIONS},
 * defaulting to 30 for anything missing or invalid.
 */
export function parseRangeDays(value: string | undefined): AnalyticsRangeDays {
  const parsed = Number(value);
  return (ANALYTICS_RANGE_OPTIONS as readonly number[]).includes(parsed) ? (parsed as AnalyticsRangeDays) : 30;
}

/**
 * A plain server-rendered link group - no client JS needed for a
 * three-way toggle that just navigates to a new `?days=` value.
 */
export function RangeSelector({ selected }: { selected: AnalyticsRangeDays }) {
  return (
    <div className="inline-flex items-center gap-1 rounded-full border border-border bg-card p-1">
      {ANALYTICS_RANGE_OPTIONS.map((days) => (
        <Link
          key={days}
          href={`/admin/analytics?days=${days}`}
          className={cn(
            "rounded-full px-3 py-1 text-sm font-medium transition-colors",
            days === selected ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {days}d
        </Link>
      ))}
    </div>
  );
}
