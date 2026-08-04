/**
 * Server Components for the core prose elements a markdown document
 * produces: headings, paragraphs, lists (including GFM task lists),
 * horizontal rules, emphasis/strong/strikethrough, blockquotes, inline
 * code, and images.
 *
 * Every export here obeys D14: props are destructured field by field,
 * never spread wholesale (`hast-util-to-jsx-runtime` includes a `key` in
 * the props object it builds, and spreading that into JSX triggers
 * React 19's "props object containing a key prop" warning).
 */

import { isValidElement, type ReactNode } from "react";

import { cn } from "@/lib/utils";
import { HugeiconsIcon } from "@hugeicons/react";
import { Link01Icon } from "@hugeicons/core-free-icons";

/** Flattens a rendered React tree back to plain text - used for a
 * heading's anchor-link `aria-label` and (via `code-block.tsx`) for a
 * code block's filename, both of which only ever nest inline content, so
 * this never needs to special-case block-level children. */
export function extractPlainText(node: ReactNode): string {
  if (typeof node === "string") {
    return node;
  }
  if (typeof node === "number") {
    return String(node);
  }
  if (Array.isArray(node)) {
    return node.map(extractPlainText).join("");
  }
  if (isValidElement(node)) {
    const props = node.props as { children?: ReactNode };
    return extractPlainText(props.children);
  }
  return "";
}

const HEADING_SIZE: Record<2 | 3 | 4 | 5 | 6, string> = {
  2: "text-2xl mt-10 mb-4",
  3: "text-xl mt-8 mb-3",
  4: "text-lg mt-6 mb-2",
  5: "text-base mt-6 mb-2",
  6: "text-sm mt-6 mb-2 uppercase tracking-wide text-muted-foreground",
};

interface HeadingProps {
  id?: string;
  children?: ReactNode;
}

function makeHeading(level: 2 | 3 | 4 | 5 | 6) {
  const Tag = `h${level}` as "h2" | "h3" | "h4" | "h5" | "h6";

  function Heading({ id, children }: HeadingProps) {
    const text = extractPlainText(children);
    return (
      <Tag
        id={id}
        className={cn(
          "group relative scroll-mt-24 font-heading font-semibold text-foreground",
          HEADING_SIZE[level],
        )}
      >
        {id !== undefined && (
          <a
            href={`#${id}`}
            aria-label={`Link to section: ${text}`}
            className="absolute -left-5 inline-flex h-full items-center opacity-0 transition-opacity focus-visible:opacity-100 group-hover:opacity-100"
          >
            <HugeiconsIcon icon={Link01Icon} size={16} strokeWidth={2} className="text-muted-foreground" />
          </a>
        )}
        {children}
      </Tag>
    );
  }
  Heading.displayName = `Markdown${Tag.toUpperCase()}`;
  return Heading;
}

export const Heading2 = makeHeading(2);
export const Heading3 = makeHeading(3);
export const Heading4 = makeHeading(4);
export const Heading5 = makeHeading(5);
export const Heading6 = makeHeading(6);

export function Paragraph({ children }: { children?: ReactNode }) {
  return <p className="my-4 max-w-[75ch] text-base leading-7 text-foreground">{children}</p>;
}

export function Strong({ children }: { children?: ReactNode }) {
  return <strong className="font-semibold text-foreground">{children}</strong>;
}

export function Emphasis({ children }: { children?: ReactNode }) {
  return <em className="italic">{children}</em>;
}

export function Strikethrough({ children }: { children?: ReactNode }) {
  return <del className="text-muted-foreground line-through">{children}</del>;
}

export function HorizontalRule() {
  return <hr className="my-8 border-border" />;
}

export function Blockquote({ children }: { children?: ReactNode }) {
  return (
    <blockquote className="my-6 border-l-4 border-primary/40 bg-muted/40 py-2 pl-4 text-muted-foreground italic">
      {children}
    </blockquote>
  );
}

export function UnorderedList({ className, children }: { className?: string; children?: ReactNode }) {
  const isTaskList = className?.includes("contains-task-list") ?? false;
  return (
    <ul
      className={cn(
        "my-4 space-y-1.5 pl-6",
        isTaskList ? "list-none pl-0" : "list-disc marker:text-muted-foreground",
      )}
    >
      {children}
    </ul>
  );
}

export function OrderedList({ children }: { children?: ReactNode }) {
  return <ol className="my-4 list-decimal space-y-1.5 pl-6 marker:text-muted-foreground">{children}</ol>;
}

export function ListItem({ className, children }: { className?: string; children?: ReactNode }) {
  const isTask = className?.includes("task-list-item") ?? false;
  return (
    <li className={cn("leading-7 text-foreground", isTask && "flex items-start gap-2")}>{children}</li>
  );
}

interface TaskListCheckboxProps {
  checked?: boolean;
  disabled?: boolean;
}

export function TaskListCheckbox({ checked, disabled }: TaskListCheckboxProps) {
  return (
    <span className="mt-1 inline-flex shrink-0 items-center">
      <input
        type="checkbox"
        checked={checked ?? false}
        disabled={disabled ?? true}
        aria-hidden="true"
        className="size-4 rounded-sm border-border accent-primary"
        readOnly
      />
      <span className="sr-only">{checked === true ? "Completed" : "Not completed"}</span>
    </span>
  );
}

interface CodeProps {
  className?: string;
  children?: ReactNode;
  "data-line-numbers"?: string;
  "data-language"?: string;
  "data-theme"?: string;
  "data-line-numbers-max-digits"?: number;
  style?: React.CSSProperties;
}

/**
 * Maps hast `code` elements. A code fence's highlighted `<code>` (inside
 * `CodeBlock`'s `<pre>`) is distinguished from ordinary inline code by the
 * `data-line-numbers` attribute `rehype-pretty-code`/Shiki always attach
 * to it - when present, this component passes the element through with
 * its Shiki attributes intact rather than applying inline-code styling
 * on top of it.
 */
export function InlineCode({
  className,
  children,
  "data-line-numbers": lineNumbers,
  "data-language": language,
  "data-theme": theme,
  "data-line-numbers-max-digits": maxDigits,
  style,
}: CodeProps) {
  if (lineNumbers !== undefined) {
    return (
      <code
        className={className}
        data-line-numbers={lineNumbers}
        data-language={language}
        data-theme={theme}
        data-line-numbers-max-digits={maxDigits}
        style={style}
      >
        {children}
      </code>
    );
  }

  return (
    <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[0.85em] break-words text-foreground">
      {children}
    </code>
  );
}

export function MarkdownImage({ src, alt }: { src?: string; alt?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- markdown images have no known intrinsic dimensions, which next/image requires
    <img
      src={src}
      alt={alt ?? ""}
      loading="lazy"
      decoding="async"
      className="my-6 h-auto max-w-full rounded-lg border border-border"
    />
  );
}
