/**
 * Site-wide SEO defaults: OG image dimensions, length limits, and the
 * organization JSON-LD fields. Data, not behaviour (D2 in the sub-task 9
 * spec) - a human edits this file directly; `/admin/seo` only reads it to
 * render a diagnostic report, never writes it.
 *
 * Client-safe by construction: no `server-only`, no `node:*` imports. It is
 * read by `lib/seo/metadata.ts` (Server Components) and can be read by any
 * Client Component that needs the same limits (e.g. a future admin editor)
 * without pulling in filesystem access.
 */

import { siteConfig } from "@/config/site";

/** Organization fields for the `Organization` JSON-LD emitted alongside
 * article structured data. */
export interface SeoOrganization {
  name: string;
  url: string;
  /** Absolute URL of the organization's logo. Unset until the project has
   * one - `buildArticleJsonLd` omits the field rather than fabricate it. */
  logoUrl?: string;
}

export interface SeoConfig {
  /** Dimensions every dynamic OG image (`app/opengraph-image.tsx` and its
   * per-route variants) renders at. */
  defaultOgImage: { width: number; height: number };
  /** `@handle` used for `twitter:site`. Unset until the project has a real
   * account - `buildPageMetadata` omits the field rather than fabricate one. */
  twitterHandle?: string;
  /** Alt text for a page that supplies no more specific description of its
   * own OG image. */
  defaultOgImageAlt: string;
  /** Above this length, `validateSeoFields` warns that a title will likely
   * be truncated in search results. */
  titleMaxLength: number;
  /** Above this length, `validateSeoFields` warns that a description will
   * likely be truncated in search results. */
  descriptionMaxLength: number;
  /** Fields for the `Organization` JSON-LD attached to article pages. */
  organization: SeoOrganization;
  /** Path prefixes `buildRobotsRules` disallows and `buildSitemapEntries`
   * must never emit a URL under (T7). */
  noindexPathPrefixes: readonly string[];
}

export const seoConfig: SeoConfig = {
  defaultOgImage: { width: 1200, height: 630 },
  defaultOgImageAlt: `${siteConfig.name} documentation`,
  titleMaxLength: 60,
  descriptionMaxLength: 160,
  organization: {
    name: siteConfig.name,
    url: siteConfig.url,
  },
  noindexPathPrefixes: ["/admin"],
};
