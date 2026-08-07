/**
 * Pure parser for a fenced code block's meta string - everything on the
 * opening fence line after the language, e.g. `title="agent.ts"
 * showLineNumbers {3-5}`. `remark-parse` hands this back as one opaque
 * string (`code.meta`, see the parser-behaviour table in the Step 8 part 2
 * spec) with no structure of its own, so every consumer that wants a title,
 * a line-numbers flag, or a highlighted-line set needs the same three
 * fields pulled out the same way (D13) - `CodeBlock` and the future code
 * group / package install components all call this instead of re-deriving
 * their own regex.
 */

/** The three pieces of information a fence meta string can carry. */
export interface CodeMeta {
  /** The `title="..."` attribute's value, or `null` if absent. */
  readonly title: string | null;
  /** Whether the bare `showLineNumbers` flag was present. */
  readonly showLineNumbers: boolean;
  /** 1-indexed line numbers named by a `{n}`, `{n-m}`, or `{n,m,n-m}`
   * range, deduplicated and sorted ascending. Empty when no range was
   * given. */
  readonly highlightedLines: readonly number[];
}

const TITLE_PATTERN = /title="([^"]*)"/;
const SHOW_LINE_NUMBERS_PATTERN = /\bshowLineNumbers\b/;
const RANGE_PATTERN = /\{([\d,\s-]+)\}/;

/**
 * Expands a `{...}` range body (`"3-5"`, `"1,3,5"`, `"1-2,5"`) into a
 * deduplicated, ascending list of line numbers. A reversed range
 * (`"5-3"`) is treated as `"3-5"` - meta authoring shouldn't have to get
 * the order right for it to work.
 */
function expandRange(spec: string): number[] {
  const lines = new Set<number>();
  for (const part of spec.split(",")) {
    const trimmed = part.trim();
    if (trimmed.length === 0) {
      continue;
    }
    const rangeMatch = /^(\d+)-(\d+)$/.exec(trimmed);
    if (rangeMatch) {
      const [, rawStart, rawEnd] = rangeMatch;
      const start = Math.min(Number(rawStart), Number(rawEnd));
      const end = Math.max(Number(rawStart), Number(rawEnd));
      for (let line = start; line <= end; line += 1) {
        lines.add(line);
      }
      continue;
    }
    const single = Number(trimmed);
    if (Number.isFinite(single)) {
      lines.add(single);
    }
  }
  return [...lines].sort((a, b) => a - b);
}

/**
 * Parses a fence meta string into its title, line-numbers flag, and
 * highlighted-line set. `null`/`undefined`/blank all mean "no meta" -
 * `mdast`'s `Code.meta` is `string | null`, and a fence with no meta at
 * all parses to `null` rather than `""`.
 *
 * @example
 * ```ts
 * parseCodeMeta('title="agent.ts" showLineNumbers {3-5}');
 * // { title: "agent.ts", showLineNumbers: true, highlightedLines: [3, 4, 5] }
 * parseCodeMeta(null);
 * // { title: null, showLineNumbers: false, highlightedLines: [] }
 * ```
 */
export function parseCodeMeta(meta: string | null | undefined): CodeMeta {
  if (meta === null || meta === undefined || meta.trim().length === 0) {
    return { title: null, showLineNumbers: false, highlightedLines: [] };
  }

  const titleMatch = TITLE_PATTERN.exec(meta);
  const rangeMatch = RANGE_PATTERN.exec(meta);

  return {
    title: titleMatch?.[1] ?? null,
    showLineNumbers: SHOW_LINE_NUMBERS_PATTERN.test(meta),
    highlightedLines: rangeMatch !== null ? expandRange(rangeMatch[1]) : [],
  };
}
