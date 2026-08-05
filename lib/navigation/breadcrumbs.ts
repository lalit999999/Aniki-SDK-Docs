/**
 * Pure breadcrumb-trail construction, shared by the breadcrumb component and
 * its structured-data output.
 *
 * This module is client-safe by construction (see `lib/navigation/index.ts`):
 * it imports nothing from `@/lib/content`, only types from
 * `@/lib/content/types`, so `DocsBreadcrumbs` can stay a plain function
 * called from both server and client rendering paths without pulling in the
 * `server-only` guard the content barrel carries.
 */

import type { DocCategory, DocMeta } from "@/lib/content/types";

/**
 * One segment of a breadcrumb trail. `href: null` marks the current page -
 * the segment that renders as text rather than a link.
 */
export interface BreadcrumbTrailItem {
  label: string;
  href: string | null;
}

/**
 * Deep-link anchor id for a category's group on `/docs`, e.g.
 * `"Getting Started"` -> `"getting-started"`. There is no `/docs/category/*`
 * route (see D2 in the Step 5 spec), so the breadcrumb's category segment
 * links here instead of inventing one.
 */
export function categoryAnchorId(category: DocCategory): string {
  return category.toLowerCase().replace(/\s+/g, "-");
}

/**
 * Builds the `Docs -> Category -> Title` trail for a document, or the
 * single-segment trail for the docs index itself (`doc: null`).
 *
 * Only `title` and `category` are read, so this accepts any doc-shaped value
 * - the full `DocMeta` from a page, or the minimal object a test constructs.
 */
export function buildBreadcrumbTrail(
  doc: Pick<DocMeta, "title" | "category"> | null,
): BreadcrumbTrailItem[] {
  if (doc === null) {
    return [{ label: "Docs", href: null }];
  }

  return [
    { label: "Docs", href: "/docs" },
    { label: doc.category, href: `/docs#${categoryAnchorId(doc.category)}` },
    { label: doc.title, href: null },
  ];
}

/**
 * Serialises a breadcrumb trail as a schema.org `BreadcrumbList`, ready to
 * embed in a `<script type="application/ld+json">` element.
 *
 * Positions are 1-based per the schema.org spec. The current page (the
 * trail's `href: null` entry) is included with a `name` but no `item` URL,
 * since it has no separate canonical link to point to - the page itself
 * already carries `<link rel="canonical">` via `generateMetadata`.
 *
 * @param trail - as produced by `buildBreadcrumbTrail`.
 * @param siteUrl - absolute origin (`siteConfig.url`) used to resolve each
 * relative `href` into the absolute URL structured data requires.
 */
export function buildBreadcrumbJsonLd(trail: readonly BreadcrumbTrailItem[], siteUrl: string): string {
  return JSON.stringify({
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: trail.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.label,
      ...(item.href !== null ? { item: new URL(item.href, siteUrl).toString() } : {}),
    })),
  });
}
