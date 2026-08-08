/**
 * Shared metadata builders (D1): one place that turns a page's title,
 * description, and path into a Next `Metadata` object, a breadcrumb JSON-LD
 * payload, an article JSON-LD payload, or a list of human-readable
 * warnings about the fields themselves. Every `generateMetadata` in the app
 * routes through `buildPageMetadata` rather than assembling its own
 * `Metadata` object, so canonical tags, OG images, and robots directives
 * can't drift between page types.
 *
 * Client-safe by construction: no `server-only`, no `node:*` imports. Only
 * string manipulation over `siteConfig.url` and `seoConfig`.
 */

import type { Metadata } from "next";

import { seoConfig } from "@/config/seo";
import { siteConfig } from "@/config/site";

import { InvalidSeoInputError } from "./errors";
import type { ArticleJsonLdInput, BreadcrumbItem, PageMetadataInput, SeoFieldWarning } from "./types";

const ABSOLUTE_URL_PATTERN = /^https?:\/\//i;

/**
 * Normalizes a site-relative path: ensures a single leading slash and
 * strips any trailing slash (the root path normalizes to `""`, so joining
 * it with the origin yields the origin itself, with no trailing slash).
 *
 * @example
 * ```ts
 * normalizePath("docs/tools"); // "/docs/tools"
 * normalizePath("/docs/tools/"); // "/docs/tools"
 * normalizePath("/"); // ""
 * ```
 */
function normalizePath(path: string): string {
  const withLeadingSlash = path.startsWith("/") ? path : `/${path}`;
  return withLeadingSlash.replace(/\/+$/, "");
}

/**
 * Builds an absolute, trailing-slash-free URL for a site-relative path.
 *
 * @throws {InvalidSeoInputError} if `path` is empty (after trimming) or if
 * `siteConfig.url` isn't a valid URL.
 *
 * @example
 * ```ts
 * buildAbsoluteUrl("/docs/tools"); // "https://example.com/docs/tools"
 * buildAbsoluteUrl("/");           // "https://example.com"
 * ```
 */
export function buildAbsoluteUrl(path: string): string {
  const trimmed = path.trim();
  if (trimmed.length === 0) {
    throw new InvalidSeoInputError("path must be non-empty", { path });
  }

  const origin = siteConfig.url.replace(/\/+$/, "");
  try {
    new URL(origin);
  } catch {
    throw new InvalidSeoInputError(`siteConfig.url is not a valid URL: "${siteConfig.url}"`, { path });
  }

  return `${origin}${normalizePath(trimmed)}`;
}

function resolveImageUrl(imageUrl: string | undefined): string | undefined {
  if (imageUrl === undefined) {
    return undefined;
  }
  return ABSOLUTE_URL_PATTERN.test(imageUrl) ? imageUrl : buildAbsoluteUrl(imageUrl);
}

/**
 * Builds a Next `Metadata` object for a single page (D1): absolute
 * canonical URL, Open Graph and Twitter cards, and `robots` when the page
 * should be excluded from indexing (T7).
 *
 * @throws {InvalidSeoInputError} if `path` is empty or `imageUrl` is a
 * site-relative path that can't be resolved to an absolute URL.
 *
 * @example
 * ```ts
 * const metadata = buildPageMetadata({
 *   title: "Tools",
 *   description: "How to define tools for an agent.",
 *   path: "/docs/tools",
 *   type: "article",
 *   noindex: false,
 * });
 * ```
 */
export function buildPageMetadata(input: PageMetadataInput): Metadata {
  const canonicalUrl = buildAbsoluteUrl(input.path);
  const imageUrl = resolveImageUrl(input.imageUrl);
  const images = imageUrl !== undefined
    ? [
        {
          url: imageUrl,
          width: seoConfig.defaultOgImage.width,
          height: seoConfig.defaultOgImage.height,
          alt: seoConfig.defaultOgImageAlt,
        },
      ]
    : undefined;

  const openGraph: Metadata["openGraph"] =
    input.type === "article"
      ? {
          title: input.title,
          description: input.description,
          url: canonicalUrl,
          siteName: siteConfig.name,
          type: "article",
          publishedTime: input.publishedAt,
          modifiedTime: input.modifiedAt,
          images,
        }
      : {
          title: input.title,
          description: input.description,
          url: canonicalUrl,
          siteName: siteConfig.name,
          type: "website",
          images,
        };

  return {
    title: input.title,
    description: input.description,
    alternates: { canonical: canonicalUrl },
    keywords: input.keywords !== undefined && input.keywords.length > 0 ? [...input.keywords] : undefined,
    robots: input.noindex === true ? { index: false, follow: true } : undefined,
    openGraph,
    twitter: {
      card: "summary_large_image",
      title: input.title,
      description: input.description,
      site: seoConfig.twitterHandle,
      images: imageUrl !== undefined ? [imageUrl] : undefined,
    },
  };
}

/**
 * Builds a `BreadcrumbList` JSON-LD payload for a `<script
 * type="application/ld+json">` tag, root-first.
 *
 * @throws {InvalidSeoInputError} if any item's `path` is empty.
 *
 * @example
 * ```ts
 * const jsonLd = buildBreadcrumbJsonLd([
 *   { label: "Docs", path: "/docs" },
 *   { label: "Tools", path: "/docs/tools" },
 * ]);
 * ```
 */
export function buildBreadcrumbJsonLd(items: readonly BreadcrumbItem[]): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.label,
      item: buildAbsoluteUrl(item.path),
    })),
  };
}

/**
 * Builds an `Article` JSON-LD payload for a `<script
 * type="application/ld+json">` tag on a documentation page or release.
 *
 * @throws {InvalidSeoInputError} if `path` is empty.
 *
 * @example
 * ```ts
 * const jsonLd = buildArticleJsonLd({
 *   title: "Tools",
 *   description: "How to define tools for an agent.",
 *   path: "/docs/tools",
 *   modifiedAt: "2026-08-03T00:00:00.000Z",
 * });
 * ```
 */
export function buildArticleJsonLd(input: ArticleJsonLdInput): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: input.title,
    description: input.description,
    url: buildAbsoluteUrl(input.path),
    datePublished: input.publishedAt,
    dateModified: input.modifiedAt,
    publisher: {
      "@type": "Organization",
      name: seoConfig.organization.name,
      url: seoConfig.organization.url,
      logo:
        seoConfig.organization.logoUrl !== undefined
          ? { "@type": "ImageObject", url: seoConfig.organization.logoUrl }
          : undefined,
    },
  };
}

const MARKDOWN_SYNTAX_PATTERN = /[*_`[\]]/;

/**
 * Checks a title/description pair for issues worth surfacing to a human
 * (D2's `/admin/seo` inspector): empty fields, over-length fields, a
 * description identical to its title, and stray markdown syntax that
 * suggests the field was copy-pasted from the document body instead of
 * authored as plain text.
 *
 * Never throws - this is a diagnostic report, not a validator that blocks
 * a build.
 *
 * @example
 * ```ts
 * validateSeoFields({ title: "Tools", description: "" });
 * // ["description is empty"]
 * ```
 */
export function validateSeoFields(input: { title: string; description: string }): readonly SeoFieldWarning[] {
  const warnings: SeoFieldWarning[] = [];
  const title = input.title.trim();
  const description = input.description.trim();

  if (title.length === 0) {
    warnings.push("title is empty");
  } else if (title.length > seoConfig.titleMaxLength) {
    warnings.push(`title exceeds ${seoConfig.titleMaxLength} characters (${title.length})`);
  }

  if (description.length === 0) {
    warnings.push("description is empty");
  } else if (description.length > seoConfig.descriptionMaxLength) {
    warnings.push(`description exceeds ${seoConfig.descriptionMaxLength} characters (${description.length})`);
  }

  if (title.length > 0 && description.length > 0 && title === description) {
    warnings.push("description is identical to title");
  }

  if (MARKDOWN_SYNTAX_PATTERN.test(title)) {
    warnings.push("title contains markdown syntax");
  }
  if (MARKDOWN_SYNTAX_PATTERN.test(description)) {
    warnings.push("description contains markdown syntax");
  }

  return warnings;
}
