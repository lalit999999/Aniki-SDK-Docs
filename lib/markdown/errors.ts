/**
 * Error taxonomy for the markdown rendering pipeline.
 *
 * Mirrors `lib/content/errors.ts` in shape: every failure path in
 * `lib/markdown` throws one of the concrete classes below rather than a
 * bare `Error`. A single `error instanceof MarkdownError` check catches
 * all of them, while `error.code` lets a caller branch on the specific
 * failure without string-matching a message.
 */

/**
 * Discriminant for every error this module can throw. Kept as a union
 * (rather than deriving it from the class list) so it can be imported
 * without pulling in the classes themselves.
 */
export type MarkdownErrorCode = "MARKDOWN_RENDER_ERROR" | "HIGHLIGHTER_ERROR";

/**
 * Base class for every error the markdown pipeline throws. Not thrown
 * directly - use one of the concrete subclasses below.
 *
 * @example
 * ```ts
 * try {
 *   await renderMarkdownToHast(source, { filePath });
 * } catch (error) {
 *   if (error instanceof MarkdownError) {
 *     console.error(error.code, error.context);
 *   }
 * }
 * ```
 */
export abstract class MarkdownError extends Error {
  abstract readonly code: MarkdownErrorCode;
  readonly context: Readonly<Record<string, unknown>>;

  constructor(
    message: string,
    options?: { context?: Record<string, unknown>; cause?: unknown },
  ) {
    super(message, options?.cause !== undefined ? { cause: options.cause } : undefined);
    this.name = this.constructor.name;
    this.context = Object.freeze({ ...(options?.context ?? {}) });
  }

  /**
   * Plain-object representation suitable for logging or serializing over
   * a boundary (API response, error tracker) that doesn't understand
   * `Error` instances.
   */
  toJSON(): { name: string; code: MarkdownErrorCode; message: string; context: Readonly<Record<string, unknown>> } {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      context: this.context,
    };
  }
}

/**
 * Thrown when the unified pipeline fails to render a markdown document to
 * hast - a hard failure (as opposed to the soft degradations described in
 * D19, e.g. an unknown fence language or an unresolvable link, neither of
 * which throws). Carries `filePath` so the Step 5 error boundary can
 * report which document failed.
 *
 * @example
 * ```ts
 * throw new MarkdownRenderError("failed to render markdown", {
 *   filePath: "content/docs/foo.md",
 * }, cause);
 * ```
 */
export class MarkdownRenderError extends MarkdownError {
  readonly code = "MARKDOWN_RENDER_ERROR" as const;

  constructor(message: string, context: { filePath?: string }, cause?: unknown) {
    super(message, { context, cause });
  }
}

/**
 * Thrown when the shared Shiki highlighter fails to initialize (D4). The
 * cached highlighter promise is reset to `null` before this is thrown, so
 * a transient failure (e.g. a grammar fetch error) doesn't poison every
 * subsequent render for the lifetime of the process.
 *
 * @example
 * ```ts
 * throw new HighlighterError("failed to create the Shiki highlighter", {
 *   themes: ["github-light-default", "github-dark-default"],
 * }, cause);
 * ```
 */
export class HighlighterError extends MarkdownError {
  readonly code = "HIGHLIGHTER_ERROR" as const;

  constructor(message: string, context: { themes: readonly string[] }, cause?: unknown) {
    super(message, { context, cause });
  }
}
