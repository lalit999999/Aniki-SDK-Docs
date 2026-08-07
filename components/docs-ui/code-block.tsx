import { HugeiconsIcon } from "@hugeicons/react";
import { CodeIcon } from "@hugeicons/core-free-icons";

import { cn } from "@/lib/utils";

import { CopyButton } from "./copy-button";

/** `CodeBlock`'s own props, exported so `CodeGroup` (T6) can type the
 * `CodeBlock` elements it receives as children - each fenced code block in
 * a `::::code-group` renders through the ordinary `code` mdast case first,
 * and the group only needs to read `lang`/`title` back off those elements
 * and re-clone them with `showHeader: false`. */
export interface CodeBlockProps {
  code: string;
  lang?: string | null;
  title?: string | null;
  showLineNumbers?: boolean;
  highlightedLines?: readonly number[];
  showHeader?: boolean;
  className?: string;
}

/**
 * The shared fenced-code presentation - window-less, unlike `Terminal`,
 * since a fence is source code rather than a recorded session. A Server
 * Component (D10): `CopyButton` is the only interactive piece, composed in
 * rather than pulling the whole block behind a client boundary.
 *
 * `showHeader` is what a code group panel (T6) turns off - the group's own
 * tab already names the block, so a second title directly above it would
 * read as a duplicate. With the header off, the copy button moves to a
 * floating position over the code itself, revealed on hover/focus, so
 * "shared copy button" (the grammar's own requirement for code groups)
 * still holds without a header to anchor it in.
 *
 * No syntax highlighting (D16, Step 8's explicit scope boundary) - lines
 * render as plain monospace text, with an optional line-number gutter and
 * highlighted-line background from `parseCodeMeta`'s output.
 *
 * @example
 * ```tsx
 * const meta = parseCodeMeta(node.meta);
 * <CodeBlock code={node.value} lang={node.lang} {...meta} />
 * ```
 */
export function CodeBlock({
  code,
  lang = null,
  title = null,
  showLineNumbers = false,
  highlightedLines = [],
  showHeader = true,
  className,
}: CodeBlockProps) {
  const lines = code.split("\n");
  const highlighted = new Set(highlightedLines);
  const label = title ?? lang;

  return (
    <div
      className={cn(
        "group/code-block relative overflow-hidden rounded-lg border border-border bg-muted/30",
        className,
      )}
    >
      {showHeader && (
        <div className="flex items-center justify-between gap-3 border-b border-border bg-muted px-4 py-2">
          <span className="flex min-w-0 items-center gap-2 truncate text-xs font-medium text-muted-foreground">
            <HugeiconsIcon icon={CodeIcon} strokeWidth={2} className="size-3.5 shrink-0" />
            <span className="truncate">{label ?? "code"}</span>
          </span>
          <CopyButton text={code} label="Copy code" />
        </div>
      )}
      <div className="relative overflow-x-auto">
        <pre className="py-3 text-sm">
          <code className="grid font-mono">
            {lines.map((line, index) => {
              const lineNumber = index + 1;
              return (
                <span
                  key={lineNumber}
                  className={cn(
                    "grid grid-cols-[auto_1fr] gap-4 px-4",
                    highlighted.has(lineNumber) && "bg-primary/10",
                  )}
                >
                  {showLineNumbers && (
                    <span className="select-none text-right text-muted-foreground/50">{lineNumber}</span>
                  )}
                  <span className="whitespace-pre">{line.length > 0 ? line : " "}</span>
                </span>
              );
            })}
          </code>
        </pre>
        {!showHeader && (
          <CopyButton
            text={code}
            label="Copy code"
            className="absolute top-2 right-2 bg-background/80 opacity-0 backdrop-blur-sm transition-opacity group-hover/code-block:opacity-100 group-focus-within/code-block:opacity-100 focus-visible:opacity-100"
          />
        )}
      </div>
    </div>
  );
}
