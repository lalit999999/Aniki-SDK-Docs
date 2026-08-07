import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";

/** The subset of `components/ui/badge`'s variants exposed to content
 * authors - `link` and `ghost` exist for interactive UI elsewhere in the
 * app, not for a static inline label in prose. */
export type DocBadgeVariant = "default" | "secondary" | "outline" | "destructive";

/**
 * `:badge[Label]{variant}` - an inline badge (Claude.md's Badges section:
 * New, Beta, Experimental, Deprecated, Stable, Latest), resolved from the
 * *text*-directive path in `markdown-nodes.tsx`. It needs no change there:
 * `TextDirectiveNode` already dispatches every `textDirective` through
 * `resolveDirective` generically and renders whatever it resolves to
 * inline (D4) - this is simply the first entry ever registered at that
 * `kind`. An unregistered text directive is unaffected and still falls
 * through to `reconstructTextDirectiveSource` (§3.1's mid-word parser
 * trap), since that fallback triggers on the *name* being absent from
 * `DOC_COMPONENTS`, not on whether any text directive at all is
 * registered.
 *
 * A Server Component: a badge has no interactive state.
 *
 * @example
 * ```md
 * Streaming support is :badge[Beta]{variant=outline} in this release.
 * ```
 */
export function DocBadge({ variant = "default", children }: { variant?: DocBadgeVariant; children?: ReactNode }) {
  return <Badge variant={variant}>{children}</Badge>;
}
