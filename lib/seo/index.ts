/**
 * Public entry point for the SEO surface: metadata building, sitemap
 * generation, and robots rules.
 *
 * Not client-safe as a whole: `./sitemap` carries its own `server-only`
 * guard (it reads `content/docs` and `content/changelog`), which
 * propagates through this barrel to anything that imports from here.
 * `buildPageMetadata`, `buildRobotsRules`, and the JSON-LD builders have no
 * filesystem dependency of their own and would be safe to import
 * individually from their own modules if a future client-side use ever
 * needed just those - but importing this barrel always pulls in the
 * server-only boundary.
 *
 * @example
 * ```ts
 * import { buildPageMetadata } from "@/lib/seo";
 *
 * export async function generateMetadata(): Promise<Metadata> {
 *   return buildPageMetadata({
 *     title: "Tools",
 *     description: "How to define tools for an agent.",
 *     path: "/docs/tools",
 *     type: "article",
 *   });
 * }
 * ```
 */

export {
  buildAbsoluteUrl,
  buildArticleJsonLd,
  buildBreadcrumbJsonLd,
  buildPageMetadata,
  validateSeoFields,
} from "./metadata";

export { buildRobotsRules } from "./robots";
export { buildSitemapEntries } from "./sitemap";

export { InvalidSeoInputError, SeoError, SitemapBuildError } from "./errors";
export type { SeoErrorCode } from "./errors";

export type {
  ArticleJsonLdInput,
  BreadcrumbItem,
  PageMetadataInput,
  SeoFieldWarning,
  SeoPageType,
} from "./types";
