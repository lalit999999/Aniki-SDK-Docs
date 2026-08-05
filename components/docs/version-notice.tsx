import Link from "next/link";
import { HugeiconsIcon } from "@hugeicons/react";
import { Alert01Icon, InformationCircleIcon } from "@hugeicons/core-free-icons";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import { findDocBySlug } from "@/lib/content";
import { getLatestVersion, getVersionById } from "@/lib/versions";

/**
 * Banner shown on every page of a non-latest documentation version (D9) -
 * distinct from `DeprecationNotice`, which flags a single superseded page
 * regardless of which version it's in. A Server Component so it can
 * actually check whether the current page exists in the latest version
 * (`findDocBySlug`) before offering a link to it, rather than guessing a
 * same-slug URL that `dynamicParams = false` would 404 on (D7).
 *
 * Renders nothing when `versionId` is the latest version.
 */
export async function VersionNotice({ versionId, slug }: { versionId: string; slug: string }) {
  const version = getVersionById(versionId);
  if (version.status === "latest") {
    return null;
  }

  const latest = getLatestVersion();
  const sameDocInLatest = await findDocBySlug(slug, latest.id);
  const latestHref = sameDocInLatest?.meta.route ?? "/docs";

  const migrationGuide =
    version.migrationGuideSlug !== undefined
      ? await findDocBySlug(version.migrationGuideSlug, versionId)
      : null;

  const isDeprecated = version.status === "deprecated";

  return (
    <Alert
      role="note"
      className={cn(
        "mb-6",
        isDeprecated
          ? "border-destructive/40 bg-destructive/5 text-destructive"
          : "border-primary/30 bg-primary/5",
      )}
    >
      <HugeiconsIcon icon={isDeprecated ? Alert01Icon : InformationCircleIcon} strokeWidth={2} />
      <AlertTitle>
        {isDeprecated ? "This version is deprecated" : "You're viewing an older version"}
      </AlertTitle>
      <AlertDescription>
        <p>
          This page documents <strong>{version.label}</strong>
          {isDeprecated ? ", which is no longer maintained." : ", which is in maintenance mode."} The
          latest documentation is <Link href={latestHref}>{sameDocInLatest !== null ? "available here" : "at /docs"}</Link>.
          {migrationGuide !== null && (
            <>
              {" "}
              See the <Link href={migrationGuide.meta.route}>migration guide</Link> for what changed.
            </>
          )}
        </p>
        {version.notice !== undefined && <p>{version.notice}</p>}
      </AlertDescription>
    </Alert>
  );
}
