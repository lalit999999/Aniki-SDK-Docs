import { MarkdownNodes } from "@/components/docs-ui/markdown-nodes";
import { parseMarkdown } from "@/lib/content";
import type { DocHeading } from "@/lib/content";

/**
 * Renders a markdown body (everything below a page's `<h1>`) to JSX.
 *
 * Thin by design: the actual mdast-to-JSX recursion, including directive
 * dispatch, lives in `MarkdownNodes` (D6 in the Step 8 part 1 spec) so any
 * page built on the same "frontmatter'd markdown with headings" shape -
 * documentation pages and release notes alike - can render its body
 * through one renderer while owning its own page header. `DocsContent`
 * renders a `Doc`'s `<h1>`; a release page renders a release's own header
 * (version, date, status). Neither needs to fake the other's shape to
 * reuse this component.
 *
 * Heading ids are not re-slugged here - they're taken in document order
 * from `headings`, the same array `TableOfContents` (or a release's
 * equivalent) was built from. This guarantees every anchor a table of
 * contents links to exists in the rendered output.
 *
 * `route` is the page's own canonical route (not necessarily part of the
 * markdown/heading data), threaded down only so inline components like
 * `HeadingAnchor` can copy the correct absolute URL for a given section -
 * it plays no part in parsing or heading ids.
 */
export function MarkdownBody({
  content,
  filePath,
  headings,
  route,
}: {
  content: string;
  filePath: string;
  headings: DocHeading[];
  route: string;
}) {
  const tree = parseMarkdown(content, filePath);

  return (
    <div className="flex flex-col gap-4 text-base leading-7 text-foreground">
      <MarkdownNodes nodes={tree.children} headingQueue={[...headings]} route={route} />
    </div>
  );
}
