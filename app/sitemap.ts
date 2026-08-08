import type { MetadataRoute } from "next";

import { buildSitemapEntries } from "@/lib/seo/sitemap";

/**
 * Statically generated at build time (D3) - this route must not be marked
 * `force-dynamic`, unlike the `app/admin/**` pages and routes.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  return buildSitemapEntries();
}
