/**
 * Public entry point for the SEO surface: metadata building today,
 * sitemap and robots generation once sub-task 2 adds them to this same
 * barrel.
 *
 * Client-safe by construction - no `server-only` guard, since nothing here
 * touches the filesystem.
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

export { InvalidSeoInputError, SeoError, SitemapBuildError } from "./errors";
export type { SeoErrorCode } from "./errors";

export type {
  ArticleJsonLdInput,
  BreadcrumbItem,
  PageMetadataInput,
  SeoFieldWarning,
  SeoPageType,
} from "./types";
