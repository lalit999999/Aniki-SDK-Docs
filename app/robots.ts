import type { MetadataRoute } from "next";

import { buildRobotsRules } from "@/lib/seo/robots";

/**
 * Statically generated at build time - this route must not be marked
 * `force-dynamic`, unlike the `app/admin/**` pages and routes.
 */
export default function robots(): MetadataRoute.Robots {
  return buildRobotsRules();
}
