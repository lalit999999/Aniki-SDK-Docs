import Link from "next/link";
import { format } from "date-fns";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowRight01Icon, Calendar01Icon, PackageIcon } from "@hugeicons/core-free-icons";

import { Badge } from "@/components/ui/badge";
import { docsIndexRoute } from "@/lib/versions";
import type { ReleaseMeta } from "@/lib/changelog";

const RELEASE_DATE_FORMAT = "d MMM yyyy";

const STATUS_BADGE_VARIANT: Record<ReleaseMeta["status"], "secondary" | "outline" | "destructive"> = {
  stable: "secondary",
  prerelease: "outline",
  yanked: "destructive",
};

/**
 * A single release's summary card on `/changelog`: version, date, status,
 * summary, highlights, a link to the corresponding docs version, and a
 * link through to the full release notes.
 */
export function ReleaseCard({ release }: { release: ReleaseMeta }) {
  return (
    <article className="rounded-lg border border-border p-6">
      <div className="mb-2 flex flex-wrap items-center gap-3">
        <h2 className="font-heading text-xl font-semibold text-foreground">
          <Link href={release.route} className="hover:underline">
            {release.title}
          </Link>
        </h2>
        <Badge variant={STATUS_BADGE_VARIANT[release.status]} className="capitalize">
          {release.status}
        </Badge>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <HugeiconsIcon icon={Calendar01Icon} strokeWidth={2} className="size-4" />
          <time dateTime={release.date}>{format(new Date(release.date), RELEASE_DATE_FORMAT)}</time>
        </span>
        <span className="flex items-center gap-1.5">
          <HugeiconsIcon icon={PackageIcon} strokeWidth={2} className="size-4" />
          v{release.version}
        </span>
        <Link href={docsIndexRoute(release.docsVersion)} className="hover:text-foreground hover:underline">
          Docs: {release.docsVersion}
        </Link>
      </div>

      <p className="mb-4 text-muted-foreground">{release.summary}</p>

      {release.highlights.length > 0 && (
        <ul className="mb-4 flex flex-col gap-1.5">
          {release.highlights.map((highlight) => (
            <li key={highlight} className="flex gap-2 text-sm text-foreground">
              <span aria-hidden="true" className="text-primary">
                •
              </span>
              {highlight}
            </li>
          ))}
        </ul>
      )}

      <Link
        href={release.route}
        className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
      >
        Full release notes
        <HugeiconsIcon icon={ArrowRight01Icon} strokeWidth={2} className="size-3.5" />
      </Link>
    </article>
  );
}
