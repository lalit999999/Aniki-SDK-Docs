import { HugeiconsIcon } from "@hugeicons/react";
import { HashIcon } from "@hugeicons/core-free-icons";

import type { HighlightSegment, SearchResult } from "@/lib/search/types";

/**
 * Renders `HighlightSegment[]` as alternating plain text and `<mark>` runs
 * - never `dangerouslySetInnerHTML` (D7). Segment data, not HTML, is what
 * lets the highlighter be exercised in a plain node test.
 */
export function HighlightedText({ segments }: { segments: readonly HighlightSegment[] }) {
  return (
    <>
      {segments.map((segment, index) =>
        segment.match ? (
          <mark key={index} className="rounded-sm bg-primary/25 text-foreground">
            {segment.text}
          </mark>
        ) : (
          <span key={index}>{segment.text}</span>
        ),
      )}
    </>
  );
}

/**
 * One row inside a search results `CommandGroup`: the matched heading (or
 * the document title, for a lead section with no heading), the document
 * title as a secondary line, and a highlighted content snippet - the
 * three things D8's requirements say a result must explain "why it
 * matched" with.
 */
export function SearchResultItem({ result }: { result: SearchResult }) {
  const { section, titleSegments, headingSegments, snippet } = result;

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-0.5 py-0.5">
      <div className="flex items-center gap-1 text-sm font-medium text-foreground">
        {headingSegments !== null ? (
          <>
            <HugeiconsIcon icon={HashIcon} strokeWidth={2} className="size-3.5 shrink-0 text-muted-foreground" />
            <span className="truncate">
              <HighlightedText segments={headingSegments} />
            </span>
          </>
        ) : (
          <span className="truncate">
            <HighlightedText segments={titleSegments} />
          </span>
        )}
      </div>

      {headingSegments !== null && (
        <p className="truncate text-xs text-muted-foreground">
          <HighlightedText segments={titleSegments} /> · {section.category}
        </p>
      )}

      <p className="truncate text-xs text-muted-foreground">
        {snippet.truncatedStart && "… "}
        <HighlightedText segments={snippet.segments} />
        {snippet.truncatedEnd && " …"}
      </p>
    </div>
  );
}
