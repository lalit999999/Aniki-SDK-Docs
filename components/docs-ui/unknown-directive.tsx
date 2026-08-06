import type { ReactNode } from "react";

/**
 * D5's fallback for a directive `resolveDirective` couldn't resolve.
 * Takes only plain data - no mdast types - so it stays a genuine
 * `docs-ui` leaf (D3): `MarkdownNodes` is the one place that knows how
 * to turn a directive node into `name`/`issues`/`fallback`, this
 * component just decides how to show them.
 *
 * In development, renders an accessible card naming the directive and
 * every issue that kept it from resolving, so a typo in a content file
 * is obvious on the page itself rather than a silent gap. In production,
 * renders `fallback` instead - the directive's own children re-rendered
 * as ordinary markdown, or (for a childless text directive) its
 * reconstructed source text - so a content bug degrades one block
 * instead of losing an author's words or crashing the page.
 */
export function UnknownDirective({
  name,
  code,
  issues,
  fallback,
}: {
  /** The directive name as written, e.g. `"warning"` for `:::warning`. */
  name: string;
  /** The originating `DocComponentError`'s `code`. */
  code: string;
  /** Every issue explaining why this directive didn't resolve. */
  issues: readonly string[];
  /** What renders in production instead of the diagnostic card. */
  fallback: ReactNode;
}) {
  if (process.env.NODE_ENV === "production") {
    return <>{fallback}</>;
  }

  return (
    <div
      role="note"
      className="rounded-lg border border-dashed border-destructive/50 bg-destructive/5 px-4 py-3 text-sm text-destructive"
    >
      <p className="font-medium">
        <span className="sr-only">Unresolved documentation directive: </span>
        <code className="font-mono">:{name}</code>
        <span className="font-normal text-destructive/70"> ({code})</span>
      </p>
      <ul className="mt-1.5 list-disc space-y-0.5 pl-5">
        {issues.map((issue) => (
          <li key={issue}>{issue}</li>
        ))}
      </ul>
    </div>
  );
}
