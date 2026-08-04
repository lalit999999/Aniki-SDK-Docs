/**
 * Shared Shiki highlighter for the markdown pipeline.
 *
 * A `Highlighter` instance owns a full set of loaded grammars and themes,
 * which is expensive to build - creating one per document would reload
 * every grammar once per document, per build (D4). This module keeps a
 * single cached instance for the whole process instead.
 *
 * The highlighter uses Shiki's JavaScript RegExp engine
 * (`createJavaScriptRegexEngine`) rather than the default Oniguruma/WASM
 * engine, so highlighting works inside Next's server build without any
 * `.wasm` bundling step (D3).
 */

import { createHighlighter, createJavaScriptRegexEngine } from "shiki";
import type { Highlighter } from "shiki";

import { HighlighterError } from "./errors";

/**
 * Light/dark theme pair every code block is highlighted against.
 * `rehype-pretty-code` emits `--shiki-light`/`--shiki-dark` CSS custom
 * properties per token when given a theme pair like this one, which
 * `app/globals.css` swaps between based on the `.dark` class (D6).
 */
export const MARKDOWN_THEMES = {
  light: "github-light-default",
  dark: "github-dark-default",
} as const;

/**
 * Curated set of languages loaded into the shared highlighter. Shiki
 * registers each grammar's common aliases automatically (`ts` for
 * `typescript`, `sh` for `bash`, etc.) - see {@link resolveLanguage}. Kept
 * deliberately small: every language actually used in `content/docs`
 * (`ts`, `bash`, `text`) plus enough common web/infra languages that a
 * future doc doesn't silently lose highlighting (D5).
 */
export const MARKDOWN_LANGUAGES = [
  "typescript",
  "tsx",
  "javascript",
  "jsx",
  "json",
  "jsonc",
  "bash",
  "shell",
  "yaml",
  "markdown",
  "html",
  "css",
  "sql",
  "diff",
  "text",
] as const;

let highlighterPromise: Promise<Highlighter> | null = null;

/**
 * Returns the shared Shiki highlighter, creating it on first call and
 * reusing it afterward.
 *
 * @throws {HighlighterError} if Shiki fails to initialize. The cached
 * promise is reset to `null` first, so a transient failure (e.g. a
 * network error loading a grammar) doesn't poison every future call for
 * the lifetime of the process - the next call gets a fresh attempt.
 *
 * @example
 * ```ts
 * const highlighter = await getMarkdownHighlighter();
 * highlighter.codeToHtml("const x = 1;", { lang: "typescript", themes: MARKDOWN_THEMES });
 * ```
 */
export function getMarkdownHighlighter(): Promise<Highlighter> {
  if (highlighterPromise === null) {
    highlighterPromise = createHighlighter({
      themes: [MARKDOWN_THEMES.light, MARKDOWN_THEMES.dark],
      langs: [...MARKDOWN_LANGUAGES],
      engine: createJavaScriptRegexEngine(),
    }).catch((error: unknown) => {
      highlighterPromise = null;
      const cause = error instanceof Error ? error : undefined;
      throw new HighlighterError(
        "failed to create the Shiki highlighter",
        { themes: [MARKDOWN_THEMES.light, MARKDOWN_THEMES.dark] },
        cause,
      );
    });
  }
  return highlighterPromise;
}

const KNOWN_LANGUAGES = new Set<string>(MARKDOWN_LANGUAGES);

/**
 * Normalises a fence language to one the shared highlighter has loaded,
 * falling back to `"text"` for anything unrecognised (D5) - a typo in a
 * fence (` ```typescrpt `) must degrade to plain text, never fail a build
 * or blank a page.
 *
 * Only checks against {@link MARKDOWN_LANGUAGES} directly; Shiki's own
 * alias table (`ts` -> `typescript`, `sh` -> `bash`, ...) is resolved
 * later by the highlighter itself, so aliases pass through unchanged here
 * and are still highlighted correctly.
 *
 * @example
 * ```ts
 * resolveLanguage("ts");         // "ts" (a known Shiki alias, passed through)
 * resolveLanguage("typescrpt");  // "text" (unknown, falls back)
 * resolveLanguage(undefined);    // "text"
 * ```
 */
export function resolveLanguage(lang: string | undefined): string {
  if (lang === undefined || lang.trim().length === 0) {
    return "text";
  }
  const normalized = lang.trim().toLowerCase();
  if (KNOWN_LANGUAGES.has(normalized) || SHIKI_ALIASES.has(normalized)) {
    return normalized;
  }
  return "text";
}

/**
 * Common Shiki aliases for the languages in {@link MARKDOWN_LANGUAGES},
 * checked alongside the canonical names in {@link resolveLanguage} so
 * fences written as ` ```ts ` or ` ```sh ` aren't misclassified as
 * unknown before Shiki ever sees them.
 */
const SHIKI_ALIASES = new Set<string>([
  "ts",
  "js",
  "sh",
  "zsh",
  "yml",
  "md",
]);

/**
 * Resets the cached highlighter. Test-only hook, in the spirit of
 * `clearContentCache()` in `lib/content/loader.ts` - lets each test case
 * start from a known state instead of sharing one process-lifetime
 * instance.
 *
 * @example
 * ```ts
 * afterEach(() => resetMarkdownHighlighter());
 * ```
 */
export function resetMarkdownHighlighter(): void {
  highlighterPromise = null;
}
