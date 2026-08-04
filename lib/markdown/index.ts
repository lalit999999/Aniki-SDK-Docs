/**
 * Public surface of the markdown rendering pipeline.
 *
 * Unlike `lib/content`, this module deliberately does NOT import
 * `server-only`. Doing so would make it untestable under Vitest, whose
 * `tests/markdown/*.test.ts` suites run this pipeline directly in a node
 * environment (D15). Server-only-ness is instead enforced structurally:
 * the single React entry point, `components/markdown/markdown.tsx`, is an
 * `async` component - React cannot treat an async component as a Client
 * Component, so nothing in this module can end up in a client bundle
 * regardless of whether `server-only` is imported here. Please don't
 * "fix" this by adding `server-only` to this file; it would break the
 * test suite for no safety benefit.
 */

export { createMarkdownProcessor, renderMarkdownToHast } from "./pipeline";
export { getMarkdownHighlighter, resetMarkdownHighlighter, resolveLanguage, MARKDOWN_THEMES, MARKDOWN_LANGUAGES } from "./highlighter";
export { MarkdownError, MarkdownRenderError, HighlighterError } from "./errors";
export type { MarkdownErrorCode } from "./errors";
export {
  CALLOUT_KINDS,
  CALLOUT_DEFINITIONS,
  CALLOUT_ALIASES,
} from "./types";
export type {
  CalloutKind,
  CalloutDefinition,
  CodeBlockMeta,
  MarkdownPipelineOptions,
} from "./types";
