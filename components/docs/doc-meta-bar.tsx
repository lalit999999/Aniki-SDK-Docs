import { format } from "date-fns";
import { HugeiconsIcon } from "@hugeicons/react";
import { Calendar03Icon, Clock01Icon, Tag01Icon } from "@hugeicons/core-free-icons";

import { Badge } from "@/components/ui/badge";
import { CopyPageUrl } from "@/components/docs/copy-page-url";
import type { DocMeta } from "@/lib/content/types";

const LAST_UPDATED_FORMAT = "d MMM yyyy";

/**
 * The metadata strip rendered directly under a document's `<h1>`: category,
 * reading time, last-updated date, tags, and the copy-page-URL action. A
 * single horizontal, wrapping row rather than a grid - the item count
 * varies per document (no file declares `tags` today, and `updatedAt` can
 * be `null`), and wrapping handles that without conditional layout.
 */
export function DocMetaBar({ meta }: { meta: DocMeta }) {
  return (
    <div className="mb-6 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
      <Badge variant="secondary">{meta.category}</Badge>

      <span className="flex items-center gap-1.5" title={`${meta.readingTime.words} words`}>
        <HugeiconsIcon icon={Clock01Icon} strokeWidth={2} className="size-4" />
        {meta.readingTime.text}
      </span>

      {meta.updatedAt !== null && (
        <span className="flex items-center gap-1.5" title={`Source: ${meta.updatedSource}`}>
          <HugeiconsIcon icon={Calendar03Icon} strokeWidth={2} className="size-4" />
          Updated <time dateTime={meta.updatedAt}>{format(new Date(meta.updatedAt), LAST_UPDATED_FORMAT)}</time>
        </span>
      )}

      {meta.tags.length > 0 && (
        <span className="flex flex-wrap items-center gap-1.5">
          <HugeiconsIcon icon={Tag01Icon} strokeWidth={2} className="size-4" />
          {meta.tags.map((tag) => (
            <Badge key={tag} variant="outline">
              {tag}
            </Badge>
          ))}
        </span>
      )}

      <CopyPageUrl route={meta.route} />
    </div>
  );
}
