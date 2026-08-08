/**
 * Type definitions for the SEO surface. Pure data shapes - no runtime
 * behaviour - shared by `metadata.ts`, `sitemap.ts`, and `robots.ts`, and by
 * the `/admin/seo` inspector that reads the same builders read-only (D2).
 */

/** Open Graph object type a page represents. `"website"` for index/listing
 * pages, `"article"` for a single documentation page or release. */
export type SeoPageType = "website" | "article";

/**
 * Input to `buildPageMetadata`: everything a page needs to describe itself,
 * independent of what kind of page it is.
 */
export interface PageMetadataInput {
  title: string;
  description: string;
  /** Site-relative path, with or without a leading slash - e.g. `"/docs/tools"`. */
  path: string;
  type: SeoPageType;
  /** ISO 8601 timestamp. Only meaningful when `type` is `"article"`. */
  publishedAt?: string;
  /** ISO 8601 timestamp. Only meaningful when `type` is `"article"`. */
  modifiedAt?: string;
  /** When `true`, emits `robots: { index: false, follow: true }` (T7). */
  noindex?: boolean;
  keywords?: readonly string[];
  /** Site-relative or absolute URL of a custom OG image. Falls back to the
   * page's dynamic `opengraph-image` route when omitted. */
  imageUrl?: string;
}

/** A single crumb in a breadcrumb trail, root first. */
export interface BreadcrumbItem {
  label: string;
  /** Site-relative path, with or without a leading slash. */
  path: string;
}

/** Input to `buildArticleJsonLd`: the schema.org fields a documentation
 * page or release actually has values for. */
export interface ArticleJsonLdInput {
  title: string;
  description: string;
  path: string;
  publishedAt?: string;
  modifiedAt?: string;
}

/** A single human-readable warning from `validateSeoFields`, e.g. "title
 * exceeds 60 characters". Plain strings rather than a coded union: this is
 * a diagnostic surface for the `/admin/seo` inspector (D2), not a control
 * flow signal anything branches on. */
export type SeoFieldWarning = string;
