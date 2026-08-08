import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { VersionInspectionEntry } from "@/lib/admin/versions";
import type { DocsVersionStatus } from "@/lib/versions";

const STATUS_BADGE_VARIANT: Record<DocsVersionStatus, "default" | "secondary" | "outline"> = {
  latest: "default",
  maintenance: "secondary",
  deprecated: "outline",
};

/**
 * The `/admin/versions` table: every declared version, its status,
 * document counts, and its derived routing behaviour (T4) - whether its
 * prefixed URLs redirect to the unprefixed form, since that's exactly what
 * changes the moment a different version is promoted to latest.
 */
export function VersionTable({ versions }: { versions: readonly VersionInspectionEntry[] }) {
  return (
    <Table>
      <TableCaption>
        Every version declared in <code>config/versions.ts</code>, with live document counts from{" "}
        <code>content/docs</code>.
      </TableCaption>
      <TableHeader>
        <TableRow>
          <TableHead>Version</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Released</TableHead>
          <TableHead>Docs</TableHead>
          <TableHead>Drafts</TableHead>
          <TableHead>Deprecated</TableHead>
          <TableHead>Index route</TableHead>
          <TableHead>Directory</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {versions.map((version) => (
          <TableRow key={version.id}>
            <TableCell className="font-medium">
              {version.label}
              <span className="ml-2 text-muted-foreground">({version.id})</span>
            </TableCell>
            <TableCell>
              <Badge variant={STATUS_BADGE_VARIANT[version.status]} className="capitalize">
                {version.status}
              </Badge>
              {version.prefixedUrlRedirects ? (
                <span className="ml-2 text-xs text-muted-foreground">
                  {`/docs/${version.id}/* redirects here`}
                </span>
              ) : null}
            </TableCell>
            <TableCell>{version.releasedAt}</TableCell>
            <TableCell>{version.docCount}</TableCell>
            <TableCell>{version.draftCount}</TableCell>
            <TableCell>{version.deprecatedCount}</TableCell>
            <TableCell>
              {version.directoryExists ? (
                <Link href={version.indexRoute} className="underline underline-offset-4 hover:text-foreground">
                  {version.indexRoute}
                </Link>
              ) : (
                <span className="text-muted-foreground">{version.indexRoute}</span>
              )}
            </TableCell>
            <TableCell>
              {version.directoryExists ? (
                <Badge variant="secondary">exists</Badge>
              ) : (
                <Badge variant="destructive">missing</Badge>
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
