import { MarkdownBody } from "@/components/docs/markdown-body";
import { MarkdownParseError, extractHeadings, parseMarkdown } from "@/lib/content";

/**
 * The editor's live preview, rendered server-side through the real
 * renderer (D3) - not a second, client-side markdown parser that would
 * inevitably drift from `MarkdownNodes` and silently mis-render every
 * `:::` directive. This is a Server Component; the editor page
 * (`app/admin/content/[version]/[slug]/page.tsx`) refreshes it by routing
 * the editor's debounced body into a `?preview=` search param and calling
 * `router.replace()` (D3's "server round-trip" option) - Next re-renders
 * this Server Component with the new `body` prop while the sibling
 * `MarkdownEditor` Client Component keeps its own in-browser state, since
 * neither its props nor its position in the tree changed.
 *
 * Malformed `:::` directives already render inline as `UnknownDirective`
 * cards rather than throwing (see `resolveDirective` in
 * `lib/doc-components/registry.ts`) - the same fallback the live site
 * uses - so nothing extra is needed for that case here. The only failure
 * this component itself guards against is `parseMarkdown` throwing
 * outright on catastrophically broken input (rare - remark-parse is very
 * permissive - but not impossible while an author is mid-keystroke), which
 * is caught and rendered as a small inline notice instead of blanking the
 * whole pane.
 */
export function PreviewPane({
  body,
  filePath,
  route,
}: {
  readonly body: string;
  readonly filePath: string;
  readonly route: string;
}) {
  let outcome: { readonly ok: true; readonly headings: ReturnType<typeof extractHeadings> } | { readonly ok: false; readonly message: string };
  try {
    const tree = parseMarkdown(body, filePath);
    outcome = { ok: true, headings: extractHeadings(tree, { maxLevel: 4 }) };
  } catch (error) {
    outcome = {
      ok: false,
      message: error instanceof MarkdownParseError ? error.message : "failed to parse markdown",
    };
  }

  if (!outcome.ok) {
    return (
      <div className="flex h-full flex-col gap-2 overflow-y-auto p-6">
        <p className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          Preview unavailable: {outcome.message}
        </p>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto p-6">
      <MarkdownBody content={body} filePath={filePath} headings={outcome.headings} route={route} />
    </div>
  );
}
