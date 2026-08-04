/**
 * Captures a code block's raw source onto its `<pre>` element before
 * `rehype-pretty-code` transforms it into Shiki's `figure`/`figcaption`
 * structure (D9).
 *
 * `CopyButton` needs the exact original source text - no syntax
 * highlighting spans, no injected line-number wrapper elements - but
 * reading it back out of the DOM after highlighting would mean stripping
 * Shiki's markup at copy time and risking a mismatch. Capturing it here,
 * while the tree is still the plain `<pre><code>` remark-rehype produces,
 * is deterministic and requires no DOM inspection at render time.
 *
 * Must run after `remark-rehype` (there is no `pre`/`code` hast structure
 * before that) and before `rehype-pretty-code` (which restructures `pre`
 * into `figure > figcaption? + pre > code`, hoisting unrecognised
 * properties - including `data-raw` - from the original `pre` up onto the
 * new `figure`).
 */

import type { Element, Root } from "hast";
import type { Plugin } from "unified";
import { toString as hastToString } from "hast-util-to-string";
import { visit } from "unist-util-visit";

/**
 * A typed rehype plugin that sets `data-raw` on every `<pre>` element
 * whose only child is a `<code>` element - i.e. every fenced code block,
 * and nothing else, since a non-code `<pre>` (there are none in
 * content/docs today, but nothing rules one out) has no single `code`
 * child to extract text from.
 *
 * @example
 * ```ts
 * unified().use(remarkRehype).use(rehypeCodeRaw).use(rehypePrettyCode)
 * ```
 */
const rehypeCodeRaw: Plugin<[], Root> = () => {
  return (tree: Root) => {
    visit(tree, "element", (node: Element) => {
      if (node.tagName !== "pre" || node.children.length !== 1) {
        return;
      }

      const [only] = node.children;
      if (only === undefined || only.type !== "element" || only.tagName !== "code") {
        return;
      }

      node.properties["data-raw"] = hastToString(only).replace(/\n$/, "");
    });
  };
};

export default rehypeCodeRaw;
