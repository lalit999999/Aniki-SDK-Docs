import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { MetadataPreview } from "@/components/admin/seo/metadata-preview";
import { SeoReportTable, type SeoReportRow } from "@/components/admin/seo/seo-report-table";
import { SitemapStatusCard } from "@/components/admin/seo/sitemap-status-card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { requireVersionsAdmin, VersionsAdminUnauthorizedError } from "@/lib/admin/versions";
import { siteConfig } from "@/config/site";
import { getAllReleaseMeta } from "@/lib/changelog";
import { getAllDocMeta, getDocVersions } from "@/lib/content";
import type { DocMeta } from "@/lib/content";
import { buildAbsoluteUrl, buildSitemapEntries, validateSeoFields } from "@/lib/seo";

/** Reads the live content index on every request. */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "SEO",
  robots: { index: false, follow: false },
};

const CHANGELOG_DESCRIPTION = "Release notes for every Aniki SDK documentation version.";

function ogImageUrlForDoc(doc: DocMeta): string {
  if (doc.slug === "index" && doc.isLatestVersion) {
    return buildAbsoluteUrl("/opengraph-image");
  }
  const segments = doc.route.replace(/^\/docs\/?/, "");
  return buildAbsoluteUrl(`/docs/opengraph-image/${segments}`);
}

/**
 * Builds the full `/admin/seo` report: the home page, every documentation
 * page across every declared version (not just the latest - an audit
 * needs to see everything), the changelog index, and every release.
 * `validateSeoFields` never throws (D2), so the only thing that can fail
 * here is the content read itself (a broken version registry, invalid
 * frontmatter) - the caller wraps this in a try/catch and renders a
 * readable error card instead of the page throwing.
 */
async function buildSeoReport(): Promise<SeoReportRow[]> {
  const rows: SeoReportRow[] = [];

  rows.push({
    route: "/",
    title: siteConfig.name,
    description: siteConfig.description,
    canonicalUrl: buildAbsoluteUrl("/"),
    ogImageUrl: buildAbsoluteUrl("/opengraph-image"),
    noindex: false,
    warnings: validateSeoFields({ title: siteConfig.name, description: siteConfig.description }),
  });

  const versions = await getDocVersions();
  for (const version of versions) {
    const docs = await getAllDocMeta(version.id);
    for (const doc of docs) {
      const noindex = !doc.isLatestVersion || doc.deprecated;
      rows.push({
        route: doc.route,
        title: doc.title,
        description: doc.description,
        canonicalUrl: buildAbsoluteUrl(doc.route),
        ogImageUrl: ogImageUrlForDoc(doc),
        noindex,
        warnings: validateSeoFields({ title: doc.title, description: doc.description }),
      });
    }
  }

  rows.push({
    route: "/changelog",
    title: "Changelog",
    description: CHANGELOG_DESCRIPTION,
    canonicalUrl: buildAbsoluteUrl("/changelog"),
    ogImageUrl: buildAbsoluteUrl("/opengraph-image"),
    noindex: false,
    warnings: validateSeoFields({ title: "Changelog", description: CHANGELOG_DESCRIPTION }),
  });

  const releases = await getAllReleaseMeta();
  for (const release of releases) {
    rows.push({
      route: release.route,
      title: release.title,
      description: release.summary,
      canonicalUrl: buildAbsoluteUrl(release.route),
      ogImageUrl: buildAbsoluteUrl("/opengraph-image"),
      noindex: false,
      warnings: validateSeoFields({ title: release.title, description: release.summary }),
    });
  }

  const descriptionCounts = new Map<string, number>();
  for (const row of rows) {
    descriptionCounts.set(row.description, (descriptionCounts.get(row.description) ?? 0) + 1);
  }

  return rows
    .map((row) =>
      (descriptionCounts.get(row.description) ?? 0) > 1
        ? { ...row, warnings: [...row.warnings, "description is duplicated across multiple pages"] }
        : row,
    )
    .sort((a, b) => b.warnings.length - a.warnings.length);
}

/**
 * Read-only SEO inspector (D2): a table of every page's title/description
 * length, canonical URL, robots directive, and validation warnings
 * (worst-first), a metadata preview panel, and sitemap status. Never
 * writes anything - `config/seo.ts` is what a human edits directly.
 */
export default async function SeoAdminPage() {
  try {
    await requireVersionsAdmin();
  } catch (error) {
    if (error instanceof VersionsAdminUnauthorizedError) {
      notFound();
    }
    throw error;
  }

  let rows: SeoReportRow[];
  let sitemapEntryCount: number | null = null;
  let reportError: string | null = null;

  try {
    rows = await buildSeoReport();
  } catch (error) {
    rows = [];
    reportError = error instanceof Error ? error.message : "failed to build the SEO report";
  }

  try {
    const entries = await buildSitemapEntries();
    sitemapEntryCount = entries.length;
  } catch {
    sitemapEntryCount = null;
  }

  return (
    <div className="mx-auto w-full max-w-5xl flex-1 px-4 py-12 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h1 className="font-heading text-3xl font-bold tracking-tight text-foreground">SEO</h1>
        <p className="mt-2 text-muted-foreground">
          Read-only diagnostics for every page&apos;s metadata. Edit <code>config/seo.ts</code> directly to change
          site-wide defaults.
        </p>
      </div>

      {reportError !== null ? (
        <Alert variant="destructive" className="mb-8">
          <AlertTitle>Could not build the SEO report</AlertTitle>
          <AlertDescription>{reportError}</AlertDescription>
        </Alert>
      ) : null}

      <div className="mb-8">
        <SitemapStatusCard entryCount={sitemapEntryCount ?? 0} generatedAt={new Date().toISOString()} />
      </div>

      {rows.length > 0 ? (
        <>
          <div className="mb-8">
            <MetadataPreview rows={rows} />
          </div>
          <SeoReportTable rows={rows} />
        </>
      ) : null}
    </div>
  );
}
