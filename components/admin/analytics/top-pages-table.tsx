import Link from "next/link";

import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { AnalyticsTopPage } from "@/lib/analytics";

/** A top page row enriched with the two links the table renders: the live
 * page, and - when the path resolves to a documentation page - the
 * corresponding editor route in Prompt B's content admin. That route
 * (`/admin/content/<version>/<slug>`) doesn't exist on this branch, so the
 * link is a dead 404 until the branches merge; it's still worth wiring up
 * now rather than after. */
export interface TopPageRow extends AnalyticsTopPage {
  adminContentHref: string | null;
}

export function TopPagesTable({ pages }: { pages: readonly TopPageRow[] }) {
  if (pages.length === 0) {
    return <p className="text-sm text-muted-foreground">No page views recorded in this range yet.</p>;
  }

  return (
    <Table>
      <TableCaption>The most-viewed pages in the selected range.</TableCaption>
      <TableHeader>
        <TableRow>
          <TableHead>Page</TableHead>
          <TableHead>Views</TableHead>
          <TableHead>Uniques</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {pages.map((page) => (
          <TableRow key={page.path}>
            <TableCell className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <Link href={page.path} className="underline underline-offset-4 hover:text-foreground">
                {page.path}
              </Link>
              {page.adminContentHref !== null ? (
                <Link
                  href={page.adminContentHref}
                  className="text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground"
                >
                  Edit
                </Link>
              ) : null}
            </TableCell>
            <TableCell>{page.views}</TableCell>
            <TableCell>{page.uniques}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
