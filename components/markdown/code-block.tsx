"use client";

/**
 * Renders the `figure` element `rehype-pretty-code` produces for a fenced
 * code block: a header bar (filename, language badge, copy button) above
 * the highlighted `<pre>`.
 *
 * `"use client"` only because {@link CopyButton} needs interactivity -
 * the highlighting itself already happened on the server, inside
 * `renderMarkdownToHast`. Shiki never reaches this file, let alone a
 * client bundle.
 */

import { Children, isValidElement, type ReactElement, type ReactNode } from "react";

import { cn } from "@/lib/utils";
import { CopyButton } from "./copy-button";
import { extractPlainText } from "./typography";

interface CodeBlockProps {
  children?: ReactNode;
  "data-raw"?: string;
  "data-rehype-pretty-code-figure"?: string;
}

function findChildByTag(children: ReactNode, tagName: string): ReactElement | undefined {
  return Children.toArray(children).find(
    (child): child is ReactElement => isValidElement(child) && child.type === tagName,
  );
}

/**
 * Maps hast `figure` elements. Verified against `rehype-pretty-code`'s
 * actual output shape: `data-raw`/`data-rehype-pretty-code-figure` on the
 * figure, an optional `data-rehype-pretty-code-title` `figcaption`
 * (present only for fences with `title="…"` meta), and a `pre` carrying
 * `data-language`.
 *
 * A `figure` without `data-rehype-pretty-code-figure` isn't a code
 * block - there are none in `content/docs` today, but nothing rules one
 * out - so it's rendered plain rather than hijacked into code-block
 * chrome.
 */
export function CodeBlock({
  children,
  "data-raw": raw,
  "data-rehype-pretty-code-figure": isCodeFigure,
}: CodeBlockProps) {
  if (isCodeFigure === undefined) {
    return <figure>{children}</figure>;
  }

  const figcaption = findChildByTag(children, "figcaption");
  const pre = findChildByTag(children, "pre");
  const figcaptionProps = figcaption?.props as { children?: ReactNode } | undefined;
  const filename = figcaptionProps !== undefined ? extractPlainText(figcaptionProps.children) : undefined;
  const language = (pre?.props as Record<string, unknown> | undefined)?.["data-language"];

  return (
    <figure className="my-6 overflow-hidden rounded-lg border border-border bg-card">
      <div className="flex items-center justify-between gap-3 border-b border-border bg-muted/50 px-4 py-2">
        <div className="flex min-w-0 items-center gap-2 text-xs">
          {filename !== undefined && filename.length > 0 && (
            <span className="truncate font-mono text-muted-foreground">{filename}</span>
          )}
          {typeof language === "string" && language.length > 0 && (
            <span
              className={cn(
                "shrink-0 rounded bg-muted px-1.5 py-0.5 font-mono text-[0.65rem] tracking-wide text-muted-foreground uppercase",
              )}
            >
              {language}
            </span>
          )}
        </div>
        <CopyButton code={raw ?? ""} />
      </div>
      <div className="max-h-[32rem] overflow-auto">{pre}</div>
    </figure>
  );
}
