/**
 * Assembles the full unified markdown-to-hast pipeline.
 *
 * Deliberately does not use `react-markdown`: its unified pipeline runs
 * synchronously (`runSync`), but Shiki-based highlighting is async -
 * combining the two throws `Cannot 'runSync' finished async transform`
 * (D1). This pipeline is built directly from `unified` instead, and its
 * hast output is converted to React separately, in
 * `components/markdown/markdown.tsx`, via `hast-util-to-jsx-runtime` -
 * the same library `react-markdown` uses internally, minus the sync
 * constraint.
 *
 * Raw HTML embedded in markdown source is deliberately dropped
 * (`allowDangerousHtml: false` below): `content/docs` contains none
 * today, and rendering it would require a sanitizer this task doesn't
 * scope in.
 */

import rehypePrettyCode from "rehype-pretty-code";
import rehypeSlug from "rehype-slug";
import remarkDirective from "remark-directive";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import { unified } from "unified";
import type { Plugin } from "unified";
import { visit } from "unist-util-visit";
import type { Element, Root } from "hast";

import { MarkdownRenderError } from "./errors";
import { getMarkdownHighlighter, MARKDOWN_THEMES } from "./highlighter";
import remarkAdmonitions from "./plugins/remark-admonitions";
import remarkCallouts from "./plugins/remark-callouts";
import remarkCodeMeta from "./plugins/remark-code-meta";
import rehypeCodeRaw from "./plugins/rehype-code-raw";
import rehypeDocLinks from "./plugins/rehype-doc-links";
import type { MarkdownPipelineOptions } from "./types";

const CELL_TAGS = new Set(["th", "td"]);

/**
 * `mdast-util-to-hast` renders a GFM table's column alignment as an
 * `align="…"` attribute on each `th`/`td`. `property-information` (which
 * `hast-util-to-jsx-runtime` consults to decide which hast properties
 * become JSX props) marks `align` as a legacy attribute with no React
 * equivalent, so it's silently dropped before `Table`/`TableHeaderCell`
 * ever see it - alignment would otherwise be lost between the pipeline
 * and the component layer with no error or warning. Converting it to an
 * inline `text-align` style survives that trip unchanged, since `style`
 * is a recognised property that `hast-util-to-jsx-runtime` parses into a
 * proper React style object.
 */
const rehypeTableAlign: Plugin<[], Root> = () => {
  return (tree: Root) => {
    visit(tree, "element", (node: Element) => {
      if (!CELL_TAGS.has(node.tagName)) {
        return;
      }
      const align = node.properties.align;
      if (typeof align !== "string") {
        return;
      }
      delete node.properties.align;
      node.properties.style = `text-align: ${align}`;
    });
  };
};

/**
 * Builds the unified processor, parsing markdown all the way through to
 * hast. Exported mainly for tests that want to inspect or extend the
 * processor directly - most callers want {@link renderMarkdownToHast}.
 *
 * Plugin order matters and is not incidental:
 * - `remarkGfm`/`remarkDirective` must run before `remarkAdmonitions`/
 *   `remarkCallouts`, which rewrite the nodes those plugins produce.
 * - `remarkCodeMeta` must run before `remarkRehype`, while code blocks
 *   are still mdast `code` nodes with a `meta` string field.
 * - `rehypeDocLinks` needs `rehypeSlug` to have already run so heading
 *   anchor ids exist for same-document `#anchor` links to target (though
 *   it doesn't rewrite them - see D13 - the ordering keeps the whole
 *   pipeline's heading-id guarantees in one place).
 * - `rehypeCodeRaw` must run after `remarkRehype` produces `pre`/`code`
 *   hast nodes, and before `rehypePrettyCode` restructures them (D9).
 * - `rehypeTableAlign` must run after `remarkRehype` produces the `align`
 *   attribute it rewrites into a `style`; its own position relative to
 *   the other rehype plugins doesn't matter, since none of them touch
 *   table cells.
 *
 * @example
 * ```ts
 * const processor = createMarkdownProcessor({ knownSlugs: ["tools"] });
 * const hast = processor.runSync(processor.parse(markdown));
 * ```
 */
export function createMarkdownProcessor(options: MarkdownPipelineOptions = {}) {
  const { knownSlugs } = options;

  return unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkDirective)
    .use(remarkAdmonitions)
    .use(remarkCallouts)
    .use(remarkCodeMeta)
    .use(remarkRehype, { allowDangerousHtml: false })
    .use(rehypeTableAlign)
    .use(rehypeSlug)
    .use(rehypeDocLinks, { knownSlugs })
    .use(rehypeCodeRaw)
    .use(rehypePrettyCode, {
      theme: MARKDOWN_THEMES,
      keepBackground: false,
      bypassInlineCode: true,
      defaultLang: "text",
      getHighlighter: () => getMarkdownHighlighter(),
    });
}

/**
 * Renders a markdown string to a hast `Root`, running the full pipeline
 * (GFM tables/task lists, admonitions, callouts, doc-link resolution,
 * Shiki highlighting) in one pass.
 *
 * @throws {MarkdownRenderError} if any stage of the pipeline throws. The
 * original error is attached as `cause` and `filePath` (when supplied)
 * is carried in `context`, so the Step 5 error boundary can report which
 * document failed.
 *
 * @example
 * ```ts
 * const hast = await renderMarkdownToHast(doc.content, {
 *   filePath: doc.meta.filePath,
 *   knownSlugs: await getDocSlugs(),
 * });
 * ```
 */
export async function renderMarkdownToHast(
  markdown: string,
  options: MarkdownPipelineOptions = {},
): Promise<Root> {
  try {
    const processor = createMarkdownProcessor(options);
    const tree = processor.parse(markdown);
    return await processor.run(tree);
  } catch (error: unknown) {
    const cause = error instanceof Error ? error : undefined;
    throw new MarkdownRenderError(
      "failed to render markdown to hast",
      { filePath: options.filePath },
      cause,
    );
  }
}
