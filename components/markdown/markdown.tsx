/**
 * The renderer's public entry point: turns a document's markdown
 * `content` string into styled React output.
 *
 * An `async` Server Component, deliberately (D16) - React cannot treat an
 * async component as a Client Component, which is what keeps
 * `lib/markdown` (and, transitively, Shiki) out of the client bundle
 * without needing a `server-only` import that would otherwise break
 * `lib/markdown`'s Vitest suites.
 */

import { Fragment } from "react";
import { jsx, jsxs } from "react/jsx-runtime";
import { toJsxRuntime } from "hast-util-to-jsx-runtime";
import type { Components } from "hast-util-to-jsx-runtime";

import { renderMarkdownToHast } from "@/lib/markdown";
import { Callout } from "./callout";
import { CodeBlock } from "./code-block";
import { MarkdownLink } from "./link";
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from "./table";
import {
  Blockquote,
  Emphasis,
  Heading2,
  Heading3,
  Heading4,
  Heading5,
  Heading6,
  HorizontalRule,
  InlineCode,
  ListItem,
  MarkdownImage,
  OrderedList,
  Paragraph,
  Strikethrough,
  Strong,
  TaskListCheckbox,
  UnorderedList,
} from "./typography";

/**
 * Maps every hast tag the pipeline can produce to the Server/Client
 * Component that renders it. Built once at module scope rather than per
 * render - none of these components close over per-render state.
 */
const components: Partial<Components> = {
  h2: Heading2,
  h3: Heading3,
  h4: Heading4,
  h5: Heading5,
  h6: Heading6,
  p: Paragraph,
  strong: Strong,
  em: Emphasis,
  del: Strikethrough,
  hr: HorizontalRule,
  blockquote: Blockquote,
  ul: UnorderedList,
  ol: OrderedList,
  li: ListItem,
  input: TaskListCheckbox,
  code: InlineCode,
  img: MarkdownImage,
  a: MarkdownLink,
  table: Table,
  thead: TableHead,
  tbody: TableBody,
  tr: TableRow,
  th: TableHeaderCell,
  td: TableCell,
  aside: Callout,
  figure: CodeBlock,
};

/**
 * Props for {@link Markdown}.
 */
export interface MarkdownProps {
  /** A document's rendered body - `doc.content` from `lib/content`, not
   * `doc.rawContent` (see D2: rendering `content` is what makes rehype-
   * slug's heading ids line up with `doc.headings[].id` for free). */
  content: string;
  /** Source file path, threaded through to `MarkdownRenderError` context
   * on a hard pipeline failure. */
  filePath?: string;
  /** Every known doc slug, for `rehype-doc-links`' `data-unresolved`
   * marker (D13). */
  knownSlugs?: readonly string[];
  className?: string;
}

/**
 * Renders a document's markdown content to React.
 *
 * @throws {MarkdownRenderError} if the underlying pipeline fails - lets
 * a route-level error boundary (Step 5) present it rather than this
 * component swallowing the failure.
 *
 * @example
 * ```tsx
 * const doc = await getDocBySlug(slug);
 * const knownSlugs = await getDocSlugs();
 * return <Markdown content={doc.content} filePath={doc.meta.filePath} knownSlugs={knownSlugs} />;
 * ```
 */
export async function Markdown({ content, filePath, knownSlugs, className }: MarkdownProps) {
  const hast = await renderMarkdownToHast(content, { filePath, knownSlugs });
  const tree = toJsxRuntime(hast, { Fragment, jsx, jsxs, components });

  return <div className={className}>{tree}</div>;
}
