import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { format } from "date-fns";

import { Badge } from "@/components/ui/badge";
import { MarkdownBody } from "@/components/docs/markdown-body";
import { PreviousNextNav } from "@/components/docs/previous-next-nav";
import { STATUS_BADGE_VARIANT } from "@/components/docs/release-card";
import { docsIndexRoute } from "@/lib/versions";
import { findReleaseBySlug, getAdjacentReleases, getReleaseSlugs } from "@/lib/changelog";
import type { ReleaseMeta } from "@/lib/changelog";

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
 * A release's own header - version, title, date, status, and the
 * corresponding docs version - followed by its body through
 * `MarkdownBody` (D14 in the sub-task 9 spec). Unlike a documentation
 * page, a release has metadata (status, docs version) a `Doc` has no
 * field for, so it renders its own header rather than routing through
 * `DocsContent`.
 */
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
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <Badge variant={STATUS_BADGE_VARIANT[release.meta.status]} className="capitalize">
          {release.meta.status}
        </Badge>
        <time dateTime={release.meta.date} className="text-sm text-muted-foreground">
          {format(new Date(release.meta.date), RELEASE_DATE_FORMAT)}
        </time>
        <Link
          href={docsIndexRoute(release.meta.docsVersion)}
          className="text-sm text-muted-foreground hover:text-foreground hover:underline"
        >
          Docs: {release.meta.docsVersion}
        </Link>
      </div>

      <h1 className="mb-3 font-heading text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
        {release.meta.title}
      </h1>
      <p className="mb-8 text-lg text-muted-foreground">{release.meta.summary}</p>

      <MarkdownBody
        content={release.content}
        filePath={release.meta.filePath}
        headings={release.headings}
        route={release.meta.route}
      />

      <div className="mt-10">
        <PreviousNextNav<ReleaseMeta>
          adjacent={adjacent}
          olderLabel="Older release"
          newerLabel="Newer release"
        />
      </div>
    </div>
  );
}
