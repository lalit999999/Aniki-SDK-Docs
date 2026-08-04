/**
 * Type definitions for the markdown rendering pipeline.
 *
 * This module has no runtime behaviour - it exists purely to give the
 * plugins in `lib/markdown/plugins`, the pipeline in `pipeline.ts`, and
 * the React components in `components/markdown` a shared vocabulary for
 * admonitions, callouts, and code block metadata.
 */

/**
 * The five admonition/callout kinds the renderer recognises. Shared by
 * `remark-admonitions` (GitHub alert syntax) and `remark-callouts`
 * (`:::directive` containers) - both plugins converge on this same set so
 * a single `Callout` component can render either's output (see D12 in the
 * spec this module implements).
 */
export type CalloutKind = "note" | "tip" | "important" | "warning" | "caution";

/**
 * Canonical callout kind order, used wherever kinds are iterated rather
 * than looked up by name (e.g. building a legend or a test fixture).
 *
 * @example
 * ```ts
 * for (const kind of CALLOUT_KINDS) {
 *   console.log(kind); // "note", then "tip", "important", "warning", "caution"
 * }
 * ```
 */
export const CALLOUT_KINDS: readonly CalloutKind[] = [
  "note",
  "tip",
  "important",
  "warning",
  "caution",
];

/**
 * A callout kind paired with the title it renders when no explicit title
 * is supplied - `:::warning` with no label falls back to `defaultTitle`,
 * while `:::warning[Careful]` overrides it.
 */
export interface CalloutDefinition {
  kind: CalloutKind;
  defaultTitle: string;
}

/**
 * Default title for every recognised callout kind, in `CALLOUT_KINDS`
 * order. `remark-admonitions` and `remark-callouts` both consult this map
 * when a block supplies no explicit title.
 *
 * @example
 * ```ts
 * CALLOUT_DEFINITIONS.warning.defaultTitle; // "Warning"
 * ```
 */
export const CALLOUT_DEFINITIONS: Readonly<Record<CalloutKind, CalloutDefinition>> = {
  note: { kind: "note", defaultTitle: "Note" },
  tip: { kind: "tip", defaultTitle: "Tip" },
  important: { kind: "important", defaultTitle: "Important" },
  warning: { kind: "warning", defaultTitle: "Warning" },
  caution: { kind: "caution", defaultTitle: "Caution" },
};

/**
 * Aliases accepted by `remark-callouts` for a directive `name` that maps
 * onto one of the five canonical `CalloutKind`s (D11). Directive names not
 * present here - and not already a `CalloutKind` - are left untouched.
 *
 * @example
 * ```ts
 * CALLOUT_ALIASES.info;    // "note"
 * CALLOUT_ALIASES.success; // "tip"
 * CALLOUT_ALIASES.danger;  // "caution"
 * ```
 */
export const CALLOUT_ALIASES: Readonly<Record<string, CalloutKind>> = {
  info: "note",
  success: "tip",
  danger: "caution",
};

/**
 * Per-fence metadata `remark-code-meta` normalises onto a `code` mdast
 * node before `remark-rehype` runs - the language after alias/fallback
 * resolution, the resolved filename (if any), and whether line numbers
 * should render (D7).
 */
export interface CodeBlockMeta {
  /** Resolved language, always one of `MARKDOWN_LANGUAGES` or `"text"`. */
  language: string;
  /** Filename from a `title="…"` meta string, if present (D8). */
  title: string | null;
  /** Whether `showLineNumbers` should be appended to the fence meta. */
  showLineNumbers: boolean;
}

/**
 * Options accepted by {@link createMarkdownProcessor} and
 * {@link renderMarkdownToHast}.
 */
export interface MarkdownPipelineOptions {
  /** Source file path, attached to `MarkdownRenderError` context so a
   * failure can be traced back to the document that caused it. */
  filePath?: string;
  /** Every known doc slug, e.g. from `getDocSlugs()`. When supplied,
   * `rehype-doc-links` marks a rewritten link `data-unresolved` if its
   * target slug isn't in this list (D13). Omit to skip that check. */
  knownSlugs?: readonly string[];
}
