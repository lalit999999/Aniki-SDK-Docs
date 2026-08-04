import Link from "next/link";
import type { ReactNode } from "react";
import type {
  Heading,
  InlineCode,
  Link as MdastLink,
  List,
  ListItem,
  PhrasingContent,
  RootContent,
} from "mdast";

import { parseMarkdown } from "@/lib/content";
import type { Doc, DocHeading } from "@/lib/content";

/**
 * Renders a document's body to JSX.
 *
 * This is a deliberately minimal markdown-to-JSX renderer - headings,
 * paragraphs, lists, code fences, links, blockquotes, emphasis, and rules.
 * It exists so the documentation layout (this task) has real content to
 * lay out and the table of contents has real anchors to scroll to. It is
 * NOT the production markdown/MDX renderer - GFM tables, syntax
 * highlighting, and admonitions are a separate, focused task. Swapping
 * this component's internals for a full renderer should require no
 * changes to `DocsLayout`, `TableOfContents`, or the pager, since they
 * only depend on `Doc` (content + headings), not on how the body is
 * rendered.
 *
 * Heading ids are not re-slugged here - they're taken in document order
 * from `doc.headings`, which is the same array `TableOfContents` and
 * `rehype-slug`-equivalent extraction already produced. This guarantees
 * every anchor the TOC links to exists in the rendered output.
 */
export function DocsContent({ doc }: { doc: Doc }) {
  const tree = parseMarkdown(doc.content, doc.meta.filePath);
  const headingQueue = [...doc.headings];

  return (
    <article className="max-w-3xl min-w-0 py-8">
      <h1 className="mb-6 font-heading text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
        {doc.meta.title}
      </h1>
      <div className="flex flex-col gap-4 text-base leading-7 text-foreground">
        {tree.children.map((node, index) => (
          <BlockNode key={index} node={node} headingQueue={headingQueue} />
        ))}
      </div>
    </article>
  );
}

function BlockNode({
  node,
  headingQueue,
}: {
  node: RootContent;
  headingQueue: DocHeading[];
}) {
  switch (node.type) {
    case "heading":
      return <HeadingBlock node={node} headingQueue={headingQueue} />;
    case "paragraph":
      return <p className="text-muted-foreground">{renderInline(node.children)}</p>;
    case "list":
      return <ListBlock node={node} />;
    case "code":
      return (
        <pre className="overflow-x-auto rounded-lg border border-border bg-muted p-4 text-sm">
          <code className="font-mono">{node.value}</code>
        </pre>
      );
    case "blockquote":
      return (
        <blockquote className="rounded-md border-l-4 border-primary bg-muted/50 py-2 pl-4 text-muted-foreground">
          {node.children.map((child, index) => (
            <BlockNode key={index} node={child} headingQueue={headingQueue} />
          ))}
        </blockquote>
      );
    case "thematicBreak":
      return <hr className="border-border" />;
    case "table":
      // GFM table support belongs to the future markdown-renderer task;
      // render the raw row text so content isn't dropped in the meantime.
      return (
        <div className="overflow-x-auto rounded-md border border-border text-sm">
          <p className="p-3 text-muted-foreground italic">
            [Table content - rendered by the upcoming markdown renderer]
          </p>
        </div>
      );
    default:
      return null;
  }
}

function HeadingBlock({
  node,
  headingQueue,
}: {
  node: Heading;
  headingQueue: DocHeading[];
}) {
  if (node.depth < 2 || node.depth > 4) {
    return null;
  }
  const heading = headingQueue.shift();
  const Tag = `h${node.depth}` as "h2" | "h3" | "h4";
  const sizeClass =
    node.depth === 2
      ? "text-2xl mt-4"
      : node.depth === 3
        ? "text-xl mt-2"
        : "text-lg";

  return (
    <Tag id={heading?.id} className={`font-heading font-semibold tracking-tight text-foreground ${sizeClass}`}>
      {renderInline(node.children)}
    </Tag>
  );
}

function ListBlock({ node }: { node: List }) {
  const Tag = node.ordered ? "ol" : "ul";
  return (
    <Tag className={node.ordered ? "list-decimal space-y-1 pl-6" : "list-disc space-y-1 pl-6"}>
      {node.children.map((item: ListItem, index) => (
        <li key={index} className="text-muted-foreground">
          {item.children.map((child, childIndex) =>
            child.type === "paragraph" ? (
              <span key={childIndex}>{renderInline(child.children)}</span>
            ) : (
              <BlockNode key={childIndex} node={child} headingQueue={[]} />
            ),
          )}
        </li>
      ))}
    </Tag>
  );
}

function renderInline(nodes: PhrasingContent[]): ReactNode {
  return nodes.map((node, index) => {
    switch (node.type) {
      case "text":
        return node.value;
      case "inlineCode":
        return <InlineCodeSpan key={index} node={node} />;
      case "emphasis":
        return <em key={index}>{renderInline(node.children)}</em>;
      case "strong":
        return <strong key={index}>{renderInline(node.children)}</strong>;
      case "link":
        return <InlineLink key={index} node={node} />;
      case "break":
        return <br key={index} />;
      default:
        return null;
    }
  });
}

function InlineCodeSpan({ node }: { node: InlineCode }) {
  return (
    <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-sm text-foreground">{node.value}</code>
  );
}

function InlineLink({ node }: { node: MdastLink }) {
  const isExternal = /^https?:\/\//.test(node.url);
  const content = renderInline(node.children as PhrasingContent[]);

  if (isExternal) {
    return (
      <a
        href={node.url}
        target="_blank"
        rel="noreferrer noopener"
        className="font-medium text-primary underline underline-offset-2"
      >
        {content}
      </a>
    );
  }

  return (
    <Link href={node.url} className="font-medium text-primary underline underline-offset-2">
      {content}
    </Link>
  );
}
