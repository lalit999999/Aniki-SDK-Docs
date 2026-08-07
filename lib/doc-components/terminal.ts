/**
 * Pure line classifier for a ` ```terminal ` fence's body.
 *
 * A terminal block is authored as plain text - no directive, no attributes
 * - because it's routed from the fence language (§3.1/T5 in the Step 8
 * part 2 spec): authors already reach for a language tag on a code fence,
 * and keeping it a real `code` mdast node means search indexing and
 * reading time treat it the same as any other code block with zero
 * special-casing.
 */

/** One line of a parsed terminal block. A `command` line's `text` has its
 * prompt (`"$ "` or `"> "`) already stripped; an `output` line's `text` is
 * exactly as authored, blank lines included. */
export type TerminalLine =
  | { readonly kind: "command"; readonly prompt: "$" | ">"; readonly text: string }
  | { readonly kind: "output"; readonly text: string };

/**
 * Splits a terminal block's raw value into classified lines. A line
 * starting with `"$ "` or `"> "` is a command (the prompt is stripped from
 * `text`); every other line, blank lines included, is output. A block with
 * no prompted lines at all classifies every line as output, which is what
 * lets a plain command-less log render through the same component.
 *
 * @example
 * ```ts
 * parseTerminalLines("$ npm install\n\nadded 1 package");
 * // [
 * //   { kind: "command", prompt: "$", text: "npm install" },
 * //   { kind: "output", text: "" },
 * //   { kind: "output", text: "added 1 package" },
 * // ]
 * ```
 */
export function parseTerminalLines(value: string): TerminalLine[] {
  return value.split("\n").map((line): TerminalLine => {
    if (line.startsWith("$ ")) {
      return { kind: "command", prompt: "$", text: line.slice(2) };
    }
    if (line.startsWith("> ")) {
      return { kind: "command", prompt: ">", text: line.slice(2) };
    }
    return { kind: "output", text: line };
  });
}

/**
 * Joins every command line's prompt-stripped text back into a single
 * string, newline-separated - what the terminal's copy control copies, so
 * pasting the result runs the commands without also pasting `$` markers or
 * recorded output.
 *
 * @example
 * ```ts
 * commandsOnly(parseTerminalLines("$ npm install\nadded 1 package\n$ npm run build"));
 * // "npm install\nnpm run build"
 * ```
 */
export function commandsOnly(lines: readonly TerminalLine[]): string {
  return lines
    .filter((line): line is Extract<TerminalLine, { kind: "command" }> => line.kind === "command")
    .map((line) => line.text)
    .join("\n");
}
