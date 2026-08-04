/**
 * Builds a nested table-of-contents tree from a flat list of headings, and
 * the inverse operation for search indexing.
 */

import type { DocHeading, TocNode } from "./types";

/**
 * Nests a flat, document-order list of headings into a tree based on
 * `level`.
 *
 * A heading whose level skips past its predecessor (an H4 directly under
 * an H2, with no H3 in between) attaches to the nearest shallower
 * ancestor rather than being dropped or throwing - `guides.md`-style
 * content is well-behaved, but reference material occasionally isn't.
 * Likewise, if the very first heading is deeper than headings that follow
 * it, those later headings become their own root-level nodes instead of
 * being orphaned under a heading they don't actually belong to.
 *
 * @example
 * ```ts
 * buildToc([
 *   { id: "a", text: "A", level: 2 },
 *   { id: "b", text: "B", level: 3 },
 *   { id: "c", text: "C", level: 2 },
 * ]);
 * // [{ ...a, children: [{ ...b, children: [] }] }, { ...c, children: [] }]
 * ```
 */
export function buildToc(headings: readonly DocHeading[]): TocNode[] {
  const root: TocNode[] = [];
  const stack: TocNode[] = [];

  for (const heading of headings) {
    const node: TocNode = { ...heading, children: [] };

    while (stack.length > 0) {
      const top = stack[stack.length - 1];
      if (top === undefined || top.level < node.level) {
        break;
      }
      stack.pop();
    }

    const parent = stack[stack.length - 1];
    if (parent === undefined) {
      root.push(node);
    } else {
      parent.children.push(node);
    }

    stack.push(node);
  }

  return root;
}

/**
 * Flattens a table-of-contents tree back into document order, dropping
 * the `children` field. The inverse of `buildToc`.
 *
 * @example
 * ```ts
 * flattenToc(buildToc(headings)); // same headings, same order
 * ```
 */
export function flattenToc(nodes: readonly TocNode[]): DocHeading[] {
  const result: DocHeading[] = [];
  for (const node of nodes) {
    const { children, ...heading } = node;
    result.push(heading);
    result.push(...flattenToc(children));
  }
  return result;
}
