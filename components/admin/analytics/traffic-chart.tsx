"use client";

import { Area, AreaChart, CartesianGrid, XAxis } from "recharts";

import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import type { AnalyticsTimeSeriesPoint } from "@/lib/analytics";

const chartConfig: ChartConfig = {
  views: { label: "Views", color: "var(--chart-1)" },
  uniques: { label: "Uniques", color: "var(--chart-2)" },
};

/**
 * Daily views/uniques area chart, plus a visually-hidden table carrying
 * the same data - an accessible alternative for anyone not consuming the
 * chart visually, per this sub-task's accessibility requirement.
 */
export function TrafficChart({ timeSeries }: { timeSeries: readonly AnalyticsTimeSeriesPoint[] }) {
  const hasData = timeSeries.some((point) => point.views > 0 || point.uniques > 0);

  return (
    <div>
      <ChartContainer config={chartConfig} className="aspect-auto h-64 w-full">
        <AreaChart data={[...timeSeries]} accessibilityLayer>
          <CartesianGrid vertical={false} />
          <XAxis
            dataKey="date"
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            minTickGap={24}
            tickFormatter={(value: string) => value.slice(5)}
          />
          <ChartTooltip content={<ChartTooltipContent />} />
          <Area
            dataKey="views"
            type="monotone"
            fill="var(--color-views)"
            stroke="var(--color-views)"
            fillOpacity={0.2}
          />
          <Area
            dataKey="uniques"
            type="monotone"
            fill="var(--color-uniques)"
            stroke="var(--color-uniques)"
            fillOpacity={0.2}
          />
        </AreaChart>
      </ChartContainer>
      {!hasData ? <p className="mt-2 text-sm text-muted-foreground">No traffic recorded in this range yet.</p> : null}
      <table className="sr-only">
        <caption>Daily views and unique visitors</caption>
        <thead>
          <tr>
            <th scope="col">Date</th>
            <th scope="col">Views</th>
            <th scope="col">Uniques</th>
          </tr>
        </thead>
        <tbody>
          {timeSeries.map((point) => (
            <tr key={point.date}>
              <td>{point.date}</td>
              <td>{point.views}</td>
              <td>{point.uniques}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
