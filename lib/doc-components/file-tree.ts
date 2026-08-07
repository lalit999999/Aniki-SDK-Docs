/**
 * Pure mdast -> `FileTreeNode[]` conversion for the `:::file-tree`
 * directive.
 *
 * A file tree's body is authored as an ordinary nested markdown list, not
 * directive syntax - there is no `:::entry` form, since a list is the
 * natural way to author a folder structure and directives would only add
 * ceremony. That means the presentational `FileTree` component cannot rely
 * on already-rendered `ReactNode` children the way most `docs-ui`
 * components do (D3): an unexecuted nested list item carries no
 * "folder vs file" or "highlighted" information a `ReactNode` could expose,
 * only the raw mdast can. `parseFileTree` is the one place that reads the
 * raw structure, kept here (not in the component) so it stays pure and
 * testable against plain mdast nodes with no React involved.
 */

import { toString as mdastToString } from "mdast-util-to-string";
import type { List, ListItem, PhrasingContent, RootContent } from "mdast";

/** One parsed entry in a file tree, folder or file. */
export interface FileTreeNode {
  /** Display name with any trailing `/` stripped - `FileTree` re-adds it
   * for folders so authoring `src` and `src/` render identically. */
  name: string;
  kind: "file" | "folder";
  /** `true` when the entry's name was authored in `**bold**`. */
  highlighted: boolean;
  children: FileTreeNode[];
}

export interface FileTreeParseOk {
  ok: true;
  nodes: FileTreeNode[];
}

export interface FileTreeParseFail {
  ok: false;
  issues: string[];
}

export type FileTreeParseResult = FileTreeParseOk | FileTreeParseFail;

function containsStrong(nodes: readonly PhrasingContent[]): boolean {
  return nodes.some(
    (node) =>
      node.type === "strong" ||
      ("children" in node && containsStrong(node.children as PhrasingContent[])),
  );
}

function parseListItem(item: ListItem): FileTreeNode {
  const paragraph = item.children.find((child) => child.type === "paragraph");
  const nestedList = item.children.find((child): child is List => child.type === "list");

  const rawName = (paragraph !== undefined ? mdastToString(paragraph) : mdastToString(item)).trim();
  const highlighted = paragraph !== undefined ? containsStrong(paragraph.children) : false;
  const hasTrailingSlash = rawName.endsWith("/");
  const name = hasTrailingSlash ? rawName.slice(0, -1) : rawName;
  const children = nestedList !== undefined ? parseList(nestedList) : [];

  return {
    name,
    kind: hasTrailingSlash || children.length > 0 ? "folder" : "file",
    highlighted,
    children,
  };
}

function parseList(list: List): FileTreeNode[] {
  return list.children.map(parseListItem);
}

/**
 * Converts a `:::file-tree` directive's body (already stripped of any D8
 * label paragraph) into a `FileTreeNode[]` tree, or a
 * `DIRECTIVE_STRUCTURE_INVALID`-shaped issue list naming what was found
 * instead of the single list this directive requires.
 *
 * @example
 * ```ts
 * // :::file-tree
 * // - src/
 * //   - **index.ts**
 * // :::
 * parseFileTree(bodyChildren);
 * // { ok: true, nodes: [{ name: "src", kind: "folder", highlighted: false,
 * //   children: [{ name: "index.ts", kind: "file", highlighted: true, children: [] }] }] }
 * ```
 */
export function parseFileTree(children: readonly RootContent[]): FileTreeParseResult {
  if (children.length !== 1) {
    return {
      ok: false,
      issues: [
        children.length === 0
          ? "expected a single markdown list, found an empty body"
          : `expected a single markdown list, found ${children.length} block-level elements`,
      ],
    };
  }

  const [only] = children;
  if (only.type !== "list") {
    return {
      ok: false,
      issues: [`expected a single markdown list, found a "${only.type}" node`],
    };
  }

  return { ok: true, nodes: parseList(only) };
}
