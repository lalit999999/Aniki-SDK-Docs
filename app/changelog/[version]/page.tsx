import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { format } from "date-fns";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowLeft01Icon, ArrowRight01Icon } from "@hugeicons/core-free-icons";

import { Badge } from "@/components/ui/badge";
import { DocsContent } from "@/components/docs/docs-content";
import { cn } from "@/lib/utils";
import { docsIndexRoute } from "@/lib/versions";
import { findReleaseBySlug, getAdjacentReleases, getReleaseSlugs } from "@/lib/changelog";
import type { Doc } from "@/lib/content";
import type { Release } from "@/lib/changelog";

const RELEASE_DATE_FORMAT = "d MMM yyyy";

/**
 * Every release is prerendered statically; anything else 404s
 * (`dynamicParams = false` below) rather than attempting a runtime
 * render.
 */
export async function generateStaticParams() {
  const slugs = await getReleaseSlugs();
  return slugs.map((slug) => ({ version: slug }));
}

export const dynamicParams = false;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ version: string }>;
}): Promise<Metadata> {
  const { version } = await params;
  const release = await findReleaseBySlug(version);
  if (release === null) {
    return {};
  }
  return {
    title: release.meta.title,
    description: release.meta.summary,
    alternates: { canonical: release.meta.route },
    openGraph: {
      title: release.meta.title,
      description: release.meta.summary,
      type: "article",
    },
  };
}

/**
 * Adapts a `Release` into the `Doc` shape `DocsContent` expects, so the
 * exact same markdown-to-JSX renderer used for docs pages renders release
 * notes too (D11) - no second renderer for what is structurally the same
 * problem (frontmatter'd markdown with headings). Only `filePath`,
 * `title`, `route`, `content`, and `headings` are ever read by
 * `DocsContent`; the remaining `DocMeta` fields have no release
 * equivalent and are filled with inert placeholders that this adapter,
 * not `DocsContent`, is responsible for.
 */
function releaseToDoc(release: Release): Doc {
  return {
    meta: {
      slug: release.meta.slug,
      route: release.meta.route,
      versionedRoute: release.meta.route,
      filePath: release.meta.filePath,
      title: release.meta.title,
      description: release.meta.summary,
      category: "Reference",
      order: 0,
      tags: [],
      draft: false,
      updatedAt: new Date(release.meta.date).toISOString(),
      updatedSource: "frontmatter",
      readingTime: { minutes: 1, words: 0, text: "" },
      version: release.meta.docsVersion,
      isLatestVersion: false,
      deprecated: false,
      deprecatedSince: null,
      deprecatedReason: null,
      replacedBy: null,
      since: null,
    },
    content: release.content,
    rawContent: release.content,
    headings: release.headings,
    toc: release.toc,
  };
}

export default async function ReleasePage({
  params,
}: {
  params: Promise<{ version: string }>;
}) {
  const { version } = await params;
  const release = await findReleaseBySlug(version);
  if (release === null) {
    notFound();
  }

  const adjacent = await getAdjacentReleases(version);

  return (
    <div className="mx-auto w-full max-w-3xl flex-1 px-4 py-12 sm:px-6 lg:px-8">
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <Badge variant="secondary" className="capitalize">
          {release.meta.status}
        </Badge>
        <time dateTime={release.meta.date} className="text-sm text-muted-foreground">
          {format(new Date(release.meta.date), RELEASE_DATE_FORMAT)}
        </time>
        <Link href={docsIndexRoute(release.meta.docsVersion)} className="text-sm text-muted-foreground hover:text-foreground hover:underline">
          Docs: {release.meta.docsVersion}
        </Link>
      </div>

      <DocsContent doc={releaseToDoc(release)} />

      <ReleaseAdjacentNav adjacent={adjacent} />
    </div>
  );
}

function ReleaseAdjacentNav({
  adjacent,
}: {
  adjacent: { previous: { slug: string; title: string } | null; next: { slug: string; title: string } | null };
}) {
  const { previous, next } = adjacent;
  if (previous === null && next === null) {
    return null;
  }

  const single = previous === null || next === null;

  return (
    <nav aria-label="Pagination" className="mt-10 grid gap-4 sm:grid-cols-2">
      {previous !== null && (
        <Link
          href={`/changelog/${previous.slug}`}
          className={cn(
            "group flex flex-col gap-1 rounded-lg border border-border p-4 transition-colors hover:bg-muted",
            single && "sm:col-span-2",
          )}
        >
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <HugeiconsIcon icon={ArrowLeft01Icon} strokeWidth={2} className="size-3.5" />
            Older release
          </span>
          <span className="font-medium text-foreground group-hover:underline">{previous.title}</span>
        </Link>
      )}
      {next !== null && (
        <Link
          href={`/changelog/${next.slug}`}
          className={cn(
            "group flex flex-col items-end gap-1 rounded-lg border border-border p-4 text-right transition-colors hover:bg-muted",
            single && "sm:col-span-2",
          )}
        >
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            Newer release
            <HugeiconsIcon icon={ArrowRight01Icon} strokeWidth={2} className="size-3.5" />
          </span>
          <span className="font-medium text-foreground group-hover:underline">{next.title}</span>
        </Link>
      )}
    </nav>
  );
}
