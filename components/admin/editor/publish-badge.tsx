import { Badge } from "@/components/ui/badge";

/**
 * The status badge cluster a content table row (or the editor header)
 * renders: publish state (draft/published) always, plus a separate
 * "Deprecated" badge when the page is deprecated - the two are
 * independent axes (a deprecated page can still be published, per
 * `lib/content`'s `deprecated` flag being orthogonal to `draft`).
 */
export function PublishBadge({
  draft,
  deprecated,
}: {
  readonly draft: boolean;
  readonly deprecated: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Badge variant={draft ? "secondary" : "default"}>{draft ? "Draft" : "Published"}</Badge>
      {deprecated && <Badge variant="outline">Deprecated</Badge>}
    </div>
  );
}
