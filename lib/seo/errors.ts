/**
 * Error taxonomy for the SEO surface: metadata building, sitemap
 * generation, and robots rules. Mirrors `lib/content/errors.ts`'s shape (a
 * `code` discriminant, a frozen `context`, a `toJSON()`) so callers that
 * already know that pattern don't have to learn a second one.
 */

/** Discriminant for every error this module can throw. */
export type SeoErrorCode = "INVALID_SEO_INPUT" | "SITEMAP_BUILD_ERROR";

/**
 * Base class for every error `lib/seo` throws. Not thrown directly - use
 * one of the concrete subclasses below.
 *
 * @example
 * ```ts
 * try {
 *   buildPageMetadata({ title: "", description: "x", path: "/x", type: "website" });
 * } catch (error) {
 *   if (error instanceof SeoError) {
 *     console.error(error.code, error.context);
 *   }
 * }
 * ```
 */
export abstract class SeoError extends Error {
  abstract readonly code: SeoErrorCode;
  readonly context: Readonly<Record<string, unknown>>;

  constructor(message: string, context?: Record<string, unknown>) {
    super(message);
    this.name = this.constructor.name;
    this.context = Object.freeze({ ...(context ?? {}) });
  }

  /**
   * Plain-object representation suitable for logging or serializing over a
   * boundary that doesn't understand `Error` instances.
   */
  toJSON(): { name: string; code: SeoErrorCode; message: string; context: Readonly<Record<string, unknown>> } {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      context: this.context,
    };
  }
}

/**
 * Thrown when `buildPageMetadata` (or a JSON-LD builder) receives input
 * that can't be turned into a valid absolute URL - an empty `path`, or a
 * `siteConfig.url` that isn't parseable. Deliberately narrow: everything
 * else (a missing description, an over-length title) is a *warning* from
 * `validateSeoFields`, not a thrown error, since a page should still render
 * with imperfect metadata rather than fail to build.
 *
 * @example
 * ```ts
 * throw new InvalidSeoInputError("path must be non-empty", { path: "" });
 * ```
 */
export class InvalidSeoInputError extends SeoError {
  readonly code = "INVALID_SEO_INPUT" as const;

  constructor(message: string, context: { path: string }) {
    super(message, context);
  }
}

/**
 * Thrown when `buildSitemapEntries` can't produce a valid entry set - e.g.
 * a duplicate URL survives deduplication, or an `/admin` path leaks in
 * (T7). Both indicate a bug in the sitemap builder itself, not bad input,
 * so this is deliberately rare.
 *
 * @example
 * ```ts
 * throw new SitemapBuildError("duplicate sitemap URL", { url: "/docs" });
 * ```
 */
export class SitemapBuildError extends SeoError {
  readonly code = "SITEMAP_BUILD_ERROR" as const;

  constructor(message: string, context: { url: string }) {
    super(message, context);
  }
}
