"use client";

import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import type { SeoReportRow } from "./seo-report-table";

/**
 * Shows the resolved OG card - image, canonical URL, title, description,
 * robots directive - for a page chosen from a `<select>` (D2's inspector,
 * never an editor). Client Component only for the selection state; the
 * data itself is passed down already-resolved from the server page.
 */
export function MetadataPreview({ rows }: { rows: readonly SeoReportRow[] }) {
  const [selectedRoute, setSelectedRoute] = useState(rows[0]?.route ?? "");
  const selected = rows.find((row) => row.route === selectedRoute) ?? rows[0];

  if (selected === undefined) {
    return null;
  }

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-4">
        <CardTitle>Metadata preview</CardTitle>
        <NativeSelect
          value={selectedRoute}
          onChange={(event) => setSelectedRoute(event.target.value)}
          size="sm"
          aria-label="Page to preview"
        >
          {rows.map((row) => (
            <NativeSelectOption key={row.route} value={row.route}>
              {row.route}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </CardHeader>
      <CardContent>
        <div className="w-full max-w-md overflow-hidden rounded-2xl border border-border">
          <div className="aspect-[1200/630] w-full bg-muted">
            {/* eslint-disable-next-line @next/next/no-img-element -- previewing an arbitrary OG image URL, not a static asset */}
            <img src={selected.ogImageUrl} alt="" className="h-full w-full object-cover" />
          </div>
          <div className="space-y-1 p-4">
            <p className="truncate text-xs text-muted-foreground">{selected.canonicalUrl}</p>
            <p className="truncate font-medium text-foreground">{selected.title}</p>
            <p className="line-clamp-2 text-sm text-muted-foreground">{selected.description}</p>
          </div>
        </div>
        <div className="mt-4 flex items-center gap-2 text-sm">
          <Badge variant={selected.noindex ? "outline" : "secondary"}>{selected.noindex ? "noindex" : "index"}</Badge>
          <span className="text-muted-foreground">
            {selected.warnings.length} warning{selected.warnings.length === 1 ? "" : "s"}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
