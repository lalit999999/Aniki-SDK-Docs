/**
 * Normalises fenced code block language and line-number metadata before
 * `remark-rehype` runs (D7).
 *
 * `rehype-pretty-code` only renders line numbers when a fence's meta
 * string contains `showLineNumbers` - but not one of the 74 fences across
 * `content/docs` carries any meta at all. Meta-driven opt-in would
 * therefore ship zero line numbers anywhere. This plugin inverts the
 * default: line numbers are ON unless the fence opts out with
 * `noLineNumbers`, is written in a language you'd copy-paste as a whole
 * command rather than read line-by-line, or is too short for numbering
 * to be useful.
 */

import type { Code, Root } from "mdast";
import type { Plugin } from "unified";
import { visit } from "unist-util-visit";

import { resolveLanguage } from "../highlighter";

/**
 * Languages commands are typically copied from, not read line-by-line -
 * line numbers get in the way more than they help.
 */
const NO_LINE_NUMBER_LANGUAGES = new Set<string>([
  "bash",
  "sh",
  "shell",
  "zsh",
  "console",
  "text",
  "plaintext",
  "diff",
]);

const NO_LINE_NUMBERS_TOKEN = /\bnoLineNumbers\b\s*/;

function countLines(value: string): number {
  if (value.length === 0) {
    return 0;
  }
  return value.split("\n").length;
}

/**
 * A typed remark plugin that resolves each `code` node's language through
 * {@link resolveLanguage} and appends `showLineNumbers` to its meta
 * string per the D7 rules above, stripping the `noLineNumbers` opt-out
 * token so `rehype-pretty-code`/Shiki never see it.
 *
 * @example
 * ```ts
 * unified().use(remarkParse).use(remarkCodeMeta).use(remarkRehype)
 * ```
 */
const remarkCodeMeta: Plugin<[], Root> = () => {
  return (tree: Root) => {
    visit(tree, "code", (node: Code) => {
      const language = resolveLanguage(node.lang ?? undefined);
      node.lang = language;

      const meta = node.meta ?? "";
      const hasOptOut = NO_LINE_NUMBERS_TOKEN.test(meta);
      const strippedMeta = meta.replace(NO_LINE_NUMBERS_TOKEN, "").trim();

      const eligible =
        !hasOptOut &&
        !NO_LINE_NUMBER_LANGUAGES.has(language) &&
        countLines(node.value) >= 2;

      const nextMeta = eligible
        ? [strippedMeta, "showLineNumbers"].filter((part) => part.length > 0).join(" ")
        : strippedMeta;

      node.meta = nextMeta.length > 0 ? nextMeta : null;
    });
  };
};

export default remarkCodeMeta;
