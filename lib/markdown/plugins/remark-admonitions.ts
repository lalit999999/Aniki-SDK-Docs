/**
 * Converts GitHub alert-syntax blockquotes (`> [!NOTE]`, `> [!TIP]`, ...)
 * into the same hast shape `remark-callouts` produces, so a single
 * `Callout` component renders both (D10, D12).
 *
 * `remark-gfm` does not implement this syntax - a `> [!NOTE]` blockquote
 * reaches this plugin as a completely ordinary blockquote whose first
 * paragraph happens to start with the literal text `"[!NOTE]"`. Two AST
 * shapes are possible, both handled here:
 *
 * 1. Marker and body share one line (`> [!NOTE]\n> Body.`): remark-parse
 *    joins them into a *single* text node, `"[!NOTE]\nBody."` - the
 *    marker is not a separate node from the body that follows it on the
 *    next quoted line.
 * 2. Marker stands alone, followed by a blank quoted line (`> [!NOTE]\n>\n>
 *    Body.`): the marker becomes its own paragraph, and the body is one
 *    or more sibling paragraphs.
 *
 * A blockquote whose first paragraph doesn't start with a recognised
 * `[!KIND]` marker - including ordinary `> **Note** — ...` prose
 * blockquotes already used throughout `content/docs` - is left completely
 * untouched.
 */

import type { Blockquote, Paragraph, Root, Text } from "mdast";
import type { Plugin } from "unified";
import { visit } from "unist-util-visit";

import { CALLOUT_DEFINITIONS } from "../types";
import type { CalloutKind } from "../types";

const MARKER_PATTERN = /^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]/i;

function isTextNode(node: Paragraph["children"][number] | undefined): node is Text {
  return node !== undefined && node.type === "text";
}

/**
 * A typed remark plugin that rewrites recognised alert blockquotes in
 * place, attaching `hName`/`hProperties` so `remark-rehype` emits
 * `<aside data-callout="…" data-callout-title="…">` instead of
 * `<blockquote>` for them.
 *
 * @example
 * ```ts
 * unified().use(remarkParse).use(remarkAdmonitions).use(remarkRehype)
 * ```
 */
const remarkAdmonitions: Plugin<[], Root> = () => {
  return (tree: Root) => {
    visit(tree, "blockquote", (node: Blockquote) => {
      const firstParagraph = node.children[0];
      if (firstParagraph === undefined || firstParagraph.type !== "paragraph") {
        return;
      }

      const firstText = firstParagraph.children[0];
      if (!isTextNode(firstText)) {
        return;
      }

      const match = MARKER_PATTERN.exec(firstText.value);
      if (match === null) {
        return;
      }

      const kind = match[1].toLowerCase() as CalloutKind;
      const remainder = firstText.value.slice(match[0].length);

      if (remainder.length === 0) {
        // Shape 2: the marker is its own paragraph. Drop it entirely -
        // the body lives in the sibling paragraph(s) that follow.
        node.children = node.children.slice(1);
      } else {
        // Shape 1: marker and body share one text node. Strip the marker
        // and the single line break that separated it from the body,
        // leaving the body's own internal line breaks untouched.
        const body = remainder.replace(/^\r?\n/, "");
        if (body.length === 0) {
          firstParagraph.children = firstParagraph.children.slice(1);
          if (firstParagraph.children.length === 0) {
            node.children = node.children.slice(1);
          }
        } else {
          firstText.value = body;
        }
      }

      node.data = {
        ...node.data,
        hName: "aside",
        hProperties: {
          "data-callout": kind,
          "data-callout-title": CALLOUT_DEFINITIONS[kind].defaultTitle,
        },
      };
    });
  };
};

export default remarkAdmonitions;
