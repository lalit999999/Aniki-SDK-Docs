/**
 * Type definitions and guards for parsed markdown directive nodes.
 *
 * `remark-directive` is a parse-level micromark extension recognizing
 * `:::name`, `::name`, and `:name` syntax; it is wired into the shared
 * processor in `lib/content/headings.ts`, so every `parseMarkdown` caller
 * already sees directive nodes. `mdast-util-directive` supplies the actual
 * node shapes and, via its own `.d.ts`, augments `@types/mdast`'s
 * `RootContentMap` / `PhrasingContentMap` / `ParagraphData` so TypeScript
 * knows about them too - but only once that augmentation has been loaded
 * somewhere in the program. Importing it here for its side effect (not its
 * values) is what makes `RootContent` include `containerDirective` and
 * `leafDirective`, and `PhrasingContent` include `textDirective`,
 * everywhere in this program, since module augmentation is program-wide.
 */

import type {} from "mdast-util-directive";
import type { ContainerDirective, LeafDirective, TextDirective } from "mdast-util-directive";
import type { PhrasingContent, RootContent } from "mdast";

/** The three directive node shapes `remark-directive` can produce. */
export type DirectiveNode = ContainerDirective | LeafDirective | TextDirective;

/** Discriminant matching each directive node's `type` field. */
export type DirectiveKind = DirectiveNode["type"];

/**
 * Narrows a block-level node to a container directive (`:::name` ... `:::`).
 *
 * @example
 * ```ts
 * if (isContainerDirective(node)) {
 *   node.children; // BlockContent | DefinitionContent, not RootContent
 * }
 * ```
 */
export function isContainerDirective(node: RootContent): node is ContainerDirective {
  return node.type === "containerDirective";
}

/**
 * Narrows a block-level node to a leaf directive (`::name{...}`, no body).
 */
export function isLeafDirective(node: RootContent): node is LeafDirective {
  return node.type === "leafDirective";
}

/**
 * Narrows an inline/phrasing node to a text directive (`:name[label]{...}`).
 */
export function isTextDirective(node: PhrasingContent): node is TextDirective {
  return node.type === "textDirective";
}
