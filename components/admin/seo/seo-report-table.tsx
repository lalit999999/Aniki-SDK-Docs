import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

/** One page's diagnostic row in the `/admin/seo` report table. */
export interface SeoReportRow {
  route: string;
  title: string;
  description: string;
  canonicalUrl: string;
  /** Absolute URL of the page's OG image, for `MetadataPreview`. */
  ogImageUrl: string;
  noindex: boolean;
  warnings: readonly string[];
}

/**
 * Every page's title/description length, canonical URL, robots directive,
 * and `validateSeoFields` warnings (D2) - a diagnostic report, never a
 * form: `config/seo.ts` is what a human edits.
 */
export function SeoReportTable({ rows }: { rows: readonly SeoReportRow[] }) {
  return (
    <Table>
      <TableCaption>
        Every page&apos;s title/description length, canonical URL, robots directive, and validation warnings,
        worst-first.
      </TableCaption>
      <TableHeader>
        <TableRow>
          <TableHead>Page</TableHead>
          <TableHead>Title</TableHead>
          <TableHead>Description</TableHead>
          <TableHead>Robots</TableHead>
          <TableHead>Warnings</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.route}>
            <TableCell>
              <Link href={row.route} className="underline underline-offset-4 hover:text-foreground">
                {row.route}
              </Link>
            </TableCell>
            <TableCell>{row.title.length} chars</TableCell>
            <TableCell>{row.description.length} chars</TableCell>
            <TableCell>
              <Badge variant={row.noindex ? "outline" : "secondary"}>{row.noindex ? "noindex" : "index"}</Badge>
            </TableCell>
            <TableCell>
              {row.warnings.length === 0 ? (
                <span className="text-muted-foreground">none</span>
              ) : (
                <ul className="list-disc pl-4 text-destructive">
                  {row.warnings.map((warning) => (
                    <li key={warning}>{warning}</li>
                  ))}
                </ul>
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
