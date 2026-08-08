import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { DocsIndex } from "@/components/docs/docs-index";
import { DeprecationNotice } from "@/components/docs/deprecation-notice";
import { DocMetaBar } from "@/components/docs/doc-meta-bar";
import { DocsBreadcrumbs } from "@/components/docs/docs-breadcrumbs";
import { DocsContent } from "@/components/docs/docs-content";
import { DocsNavMobile } from "@/components/docs/docs-nav-mobile";
import { DocsSidebar } from "@/components/docs/docs-sidebar";
import { EditOnGithub } from "@/components/docs/edit-on-github";
import { MobileToc } from "@/components/docs/mobile-toc";
import { PreviousNextNav } from "@/components/docs/previous-next-nav";
import { TableOfContents } from "@/components/docs/table-of-contents";
import { VersionNotice } from "@/components/docs/version-notice";
import { AnalyticsCollector } from "@/components/analytics/analytics-collector";
import {
  findDocBySlug,
  getAdjacentDocs,
  getAllDocMeta,
  getAllVersionedRoutes,
  getDocNavigation,
} from "@/lib/content";
import { buildPageMetadata } from "@/lib/seo";
import { getVersionById } from "@/lib/versions";
import { resolveDocsPath } from "@/lib/versions/route";

/**
 * Every page in every documentation version is prerendered statically
 * (`getAllVersionedRoutes`, D5/D6); anything else 404s (`dynamicParams =
 * false` below) rather than attempting a runtime render.
 */
export async function generateStaticParams() {
  const routes = await getAllVersionedRoutes();
  return routes.map((route) => ({ slug: route.segments }));
}

export const dynamicParams = false;

function segmentsFromParam(slug: string[] | undefined): string[] {
  return slug ?? [];
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string[] }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const segments = segmentsFromParam(slug);
  const resolved = resolveDocsPath(segments);
  if (resolved === null) {
    return {};
  }

  const { versionId, docSlug } = resolved;
  const imageUrl = `/docs/opengraph-image/${segments.join("/")}`;

  if (docSlug === null) {
    const index = await findDocBySlug("index", versionId);
    if (index === null) {
      return {};
    }
    return buildPageMetadata({
      title: index.meta.title,
      description: index.meta.description,
      path: index.meta.route,
      type: "website",
      noindex: !index.meta.isLatestVersion,
      imageUrl,
    });
  }

  const doc = await findDocBySlug(docSlug, versionId);
  if (doc === null) {
    return {};
  }
  return buildPageMetadata({
    title: doc.meta.title,
    description: doc.meta.description,
    path: doc.meta.route,
    type: "article",
    modifiedAt: doc.meta.updatedAt ?? undefined,
    noindex: doc.meta.deprecated,
    keywords: doc.meta.tags.length > 0 ? doc.meta.tags : undefined,
    imageUrl,
  });
}

export default async function DocsCatchAllPage({
  params,
}: {
  params: Promise<{ slug: string[] }>;
}) {
  const { slug } = await params;
  const resolved = resolveDocsPath(segmentsFromParam(slug));
  if (resolved === null) {
    notFound();
  }

  const { versionId, docSlug } = resolved;
  const version = getVersionById(versionId);
  const nav = await getDocNavigation(versionId);

  if (docSlug === null) {
    const index = await findDocBySlug("index", versionId);
    if (index === null) {
      notFound();
    }
    const meta = await getAllDocMeta(versionId);
    return (
      <>
        <AnalyticsCollector versionId={versionId} />
        <DocsNavMobile nav={nav} version={version} />
        <DocsSidebar nav={nav} version={version} />
        <DocsIndex index={index} docs={meta} version={version} />
      </>
    );
  }

  const doc = await findDocBySlug(docSlug, versionId);
  if (doc === null) {
    notFound();
  }

  const adjacent = await getAdjacentDocs(docSlug, versionId);

  return (
    <>
      <AnalyticsCollector versionId={versionId} />
      <DocsNavMobile nav={nav} version={version} />
      <DocsSidebar nav={nav} version={version} />
      <div className="min-w-0 py-8">
        <DocsBreadcrumbs doc={doc.meta} />
        <VersionNotice versionId={versionId} slug={docSlug} />
        <DeprecationNotice meta={doc.meta} />
        <MobileToc toc={doc.toc} />
        <DocsContent doc={doc} afterTitle={<DocMetaBar meta={doc.meta} />} />
        <div className="mt-4 mb-8">
          <EditOnGithub filePath={doc.meta.filePath} />
        </div>
        <PreviousNextNav adjacent={adjacent} />
      </div>
      <TableOfContents toc={doc.toc} />
    </>
  );
}
