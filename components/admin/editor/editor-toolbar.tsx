"use client";

import { Button } from "@/components/ui/button";
import type { DirectiveKind } from "@/lib/doc-components/types";

/** What a toolbar button inserts around the current selection (or at the
 * cursor, if nothing is selected) - `before` and `after` bracket whatever
 * text was selected, e.g. bold wraps the selection in `**`/`**`. */
export interface ToolbarInsertion {
  readonly before: string;
  readonly after: string;
}

function directiveInsertion(name: string, kind: DirectiveKind): ToolbarInsertion {
  switch (kind) {
    case "containerDirective":
      return { before: `:::${name}\n`, after: "\n:::\n" };
    case "leafDirective":
      return { before: `::${name}{}`, after: "" };
    case "textDirective":
      return { before: `:${name}[`, after: "]" };
  }
}

/**
 * Insert helpers for the editor's textarea: heading, bold, code fence,
 * link, and one button per top-level directive registered in
 * `lib/doc-components/registry.ts`. The directive list is read from the
 * registry (via the `directives` prop, computed server-side in
 * `app/admin/content/[version]/[slug]/page.tsx` since the registry module
 * pulls in the full `docs-ui` component tree, which has no business in
 * this Client Component's bundle) rather than hardcoded here - if the
 * registry is ever empty, this renders no directive buttons at all rather
 * than inventing names that don't exist.
 *
 * Child-only directives (`tab`, `step`, `accordion-item`, `card`,
 * `feature` - anything only ever valid nested inside another directive,
 * per each entry's `allowedChildren`) are excluded from `directives`
 * before it reaches this component; see `getInsertableDirectives` in the
 * page.
 */
export function EditorToolbar({
  directives,
  onInsert,
}: {
  readonly directives: readonly { name: string; kind: DirectiveKind }[];
  readonly onInsert: (insertion: ToolbarInsertion) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1 border-b border-border pb-2" role="toolbar" aria-label="Formatting">
      <Button type="button" variant="ghost" size="sm" onClick={() => onInsert({ before: "## ", after: "" })}>
        Heading
      </Button>
      <Button type="button" variant="ghost" size="sm" onClick={() => onInsert({ before: "**", after: "**" })}>
        Bold
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => onInsert({ before: "```\n", after: "\n```" })}
      >
        Code
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => onInsert({ before: "[", after: "](https://)" })}
      >
        Link
      </Button>
      {directives.length > 0 && <span className="mx-1 h-5 w-px bg-border" aria-hidden="true" />}
      {directives.map((directive) => (
        <Button
          key={directive.name}
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => onInsert(directiveInsertion(directive.name, directive.kind))}
        >
          {directive.name}
        </Button>
      ))}
    </div>
  );
}
