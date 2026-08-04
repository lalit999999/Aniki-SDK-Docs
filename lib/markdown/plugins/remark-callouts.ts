/**
 * Converts `remark-directive` container directives (`:::tip ... :::`)
 * into the same hast shape `remark-admonitions` produces, so a single
 * `Callout` component renders both (D11, D12).
 *
 * Verified AST shape: a `containerDirective` node with `name`,
 * `attributes`, and - only when the directive opens with a `[Label]` -
 * a first child `paragraph` carrying `data.directiveLabel === true`.
 *
 * ```md
 * :::tip[Custom title]
 * Body with **markdown**.
 * :::
 *
 * :::warning
 * Uses the default title for its kind.
 * :::
 * ```
 *
 * Title precedence is `[Label]`, then `attributes.title`, then the
 * kind's default title. A directive `name` that isn't a recognised kind
 * or alias is left completely untouched - `remark-rehype` renders it as
 * a plain `div` and the author's content survives unchanged.
 */

import type { BlockContent, DefinitionContent, Paragraph, Root } from "mdast";
import type { Plugin } from "unified";
import { visit } from "unist-util-visit";
import { toString as mdastToString } from "mdast-util-to-string";

// Side-effect import: augments `mdast`'s RootContentMap with
// `containerDirective`/`leafDirective`/`textDirective` and adds
// `directiveLabel` to `ParagraphData`, so the types below see the nodes
// `remark-directive` actually produces instead of `never`.
import type {} from "mdast-util-directive";

import { CALLOUT_ALIASES, CALLOUT_DEFINITIONS, CALLOUT_KINDS } from "../types";
import type { CalloutKind } from "../types";

const KNOWN_KINDS = new Set<string>(CALLOUT_KINDS);

function resolveKind(name: string): CalloutKind | null {
  const normalized = name.toLowerCase();
  if (KNOWN_KINDS.has(normalized)) {
    return normalized as CalloutKind;
  }
  return CALLOUT_ALIASES[normalized] ?? null;
}

function isLabelParagraph(node: BlockContent | DefinitionContent | undefined): node is Paragraph {
  return (
    node !== undefined &&
    node.type === "paragraph" &&
    (node as Paragraph).data?.directiveLabel === true
  );
}

/**
 * A typed remark plugin that rewrites recognised container directives in
 * place, attaching `hName`/`hProperties` so `remark-rehype` emits
 * `<aside data-callout="…" data-callout-title="…">` for them - the exact
 * same contract `remark-admonitions` produces.
 *
 * @example
 * ```ts
 * unified().use(remarkParse).use(remarkDirective).use(remarkCallouts).use(remarkRehype)
 * ```
 */
const remarkCallouts: Plugin<[], Root> = () => {
  return (tree: Root) => {
    visit(tree, "containerDirective", (node) => {
      const kind = resolveKind(node.name);
      if (kind === null) {
        return;
      }

      const attributes = node.attributes ?? {};
      const labelNode = isLabelParagraph(node.children[0]) ? node.children[0] : undefined;

      const title =
        (labelNode !== undefined ? mdastToString(labelNode) : undefined) ??
        attributes.title ??
        CALLOUT_DEFINITIONS[kind].defaultTitle;

      if (labelNode !== undefined) {
        node.children = node.children.slice(1);
      }

      node.data = {
        ...node.data,
        hName: "aside",
        hProperties: {
          "data-callout": kind,
          "data-callout-title": title,
        },
      };
    });
  };
};

export default remarkCallouts;
