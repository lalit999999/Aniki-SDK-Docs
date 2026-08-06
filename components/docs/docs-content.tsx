import { MarkdownBody } from "@/components/docs/markdown-body";
import type { Doc } from "@/lib/content";

/**
 * A documentation page's `<h1>` plus its rendered body.
 *
 * Thin by design (D14 in the sub-task 9 spec): the block-by-block markdown
 * renderer lives in `MarkdownBody`, shared with release notes pages, which
 * have their own header (version, date, status) instead of a `Doc`'s
 * title. This component's only job is the part that's actually specific
 * to a `Doc` - its title - plus `afterTitle`, the metadata bar's slot.
 *
 * `afterTitle` renders immediately after the `<h1>` (D11 in the Step 6
 * spec) - the metadata bar's natural position - without this component
 * needing to know anything about what it renders.
 */
export function DocsContent({ doc, afterTitle }: { doc: Doc; afterTitle?: React.ReactNode }) {
  return (
    <article className="max-w-3xl min-w-0 py-8">
      <h1 className="mb-6 font-heading text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
        {doc.meta.title}
      </h1>
      {afterTitle}
      <MarkdownBody
        content={doc.content}
        filePath={doc.meta.filePath}
        headings={doc.headings}
        route={doc.meta.route}
      />
    </article>
  );
}
