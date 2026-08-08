/**
 * Robots rules builder for `app/robots.ts`. Pure - no filesystem access -
 * so it stays out of `lib/seo/sitemap.ts`'s `server-only` boundary.
 */

import type { MetadataRoute } from "next";

import { seoConfig } from "@/config/seo";

import { buildAbsoluteUrl } from "./metadata";

const API_DISALLOW_PREFIX = "/api/";

/**
 * Builds the site's robots rules (D3): allow everything by default,
 * disallow `/api/` and every prefix in `seoConfig.noindexPathPrefixes`
 * (which includes `/admin`), and point crawlers at the sitemap.
 *
 * @example
 * ```ts
 * buildRobotsRules();
 * // {
 * //   rules: { userAgent: "*", allow: "/", disallow: ["/api/", "/admin"] },
 * //   sitemap: "https://example.com/sitemap.xml",
 * // }
 * ```
 */
export function buildRobotsRules(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [API_DISALLOW_PREFIX, ...seoConfig.noindexPathPrefixes],
    },
    sitemap: buildAbsoluteUrl("/sitemap.xml"),
  };
}
