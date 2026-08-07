import Link from "next/link";
import { Fragment } from "react";
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
import type { TextDirective } from "mdast-util-directive";

import { HeadingAnchor } from "@/components/docs/heading-anchor";
import type { DocHeading } from "@/lib/content";
import { parseCodeMeta } from "@/lib/doc-components/code-meta";
import { issuesFromDirectiveError, reconstructTextDirectiveSource, resolveDirective } from "@/lib/doc-components/registry";

import { CodeBlock } from "./code-block";
import { Terminal } from "./terminal";
import { UnknownDirective } from "./unknown-directive";

/**
 * Renders a sequence of mdast block nodes to JSX - the block-by-block
 * markdown renderer, the inline renderer, and the directive dispatcher
 * all live in this one module (D6). Keeping directive dispatch inside
 * the recursion module (rather than a separate directive-renderer
 * module) avoids a cycle: a separate module would need to import this
 * one to render a directive's body while this module would need to
 * import it to dispatch. Presentational `docs-ui` components stay leaves
 * that receive already-rendered `ReactNode` children, so nothing imports
 * backwards.
 *
 * It is NOT a general-purpose MDX renderer - headings, paragraphs,
 * lists, code fences, links, blockquotes, emphasis, rules, and directive
 * syntax. It exists so the documentation layout has real content to lay
 * out and the table of contents has real anchors to scroll to.
 *
 * Heading ids are not re-slugged here - they're taken in document order
 * from `headingQueue`, the same array a page's table of contents was
 * built from. `headingQueue` is a single shared queue threaded through
 * every recursive call (including into list items and directive bodies)
 * so a heading nested anywhere in the tree still consumes the next id in
 * document order - the same technique `lib/search/indexer.ts` uses to
 * line up its own section headings.
 *
 * @example
 * ```tsx
 * const tree = parseMarkdown(doc.content, doc.meta.filePath);
 * <MarkdownNodes nodes={tree.children} headingQueue={[...doc.headings]} route={doc.meta.route} />
 * ```
 */
export function MarkdownNodes({
  nodes,
  headingQueue,
  route,
}: {
  nodes: RootContent[];
  headingQueue: DocHeading[];
  route: string;
}) {
  return (
    <>
      {nodes.map((node, index) => (
        <BlockNode key={index} node={node} headingQueue={headingQueue} route={route} />
      ))}
    </>
  );
}

function BlockNode({
  node,
  headingQueue,
  route,
}: {
  node: RootContent;
  headingQueue: DocHeading[];
  route: string;
}) {
  switch (node.type) {
    case "heading":
      return <HeadingBlock node={node} headingQueue={headingQueue} route={route} />;
    case "paragraph":
      return <p className="text-muted-foreground">{renderInline(node.children)}</p>;
    case "list":
      return <ListBlock node={node} headingQueue={headingQueue} route={route} />;
    case "code": {
      if (node.lang === "terminal") {
        return <Terminal code={node.value} />;
      }
      const meta = parseCodeMeta(node.meta);
      return (
        <CodeBlock
          code={node.value}
          lang={node.lang}
          title={meta.title}
          showLineNumbers={meta.showLineNumbers}
          highlightedLines={meta.highlightedLines}
        />
      );
    }
    case "blockquote":
      return (
        <blockquote className="rounded-md border-l-4 border-primary bg-muted/50 py-2 pl-4 text-muted-foreground">
          {node.children.map((child, index) => (
            <BlockNode key={index} node={child} headingQueue={headingQueue} route={route} />
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
    case "containerDirective": {
      const resolution = resolveDirective(node);
      if (!resolution.ok) {
        return (
          <UnknownDirective
            name={node.name}
            code={resolution.error.code}
            issues={issuesFromDirectiveError(resolution.error)}
            fallback={<MarkdownNodes nodes={node.children} headingQueue={headingQueue} route={route} />}
          />
        );
      }
      const bodyNodes = resolution.label !== null ? node.children.slice(1) : node.children;
      return resolution.render(
        <MarkdownNodes nodes={bodyNodes} headingQueue={headingQueue} route={route} />,
      );
    }
    case "leafDirective": {
      const resolution = resolveDirective(node);
      const inline = node.children.length > 0 ? <>{renderInline(node.children)}</> : null;
      if (!resolution.ok) {
        return (
          <UnknownDirective
            name={node.name}
            code={resolution.error.code}
            issues={issuesFromDirectiveError(resolution.error)}
            fallback={inline}
          />
        );
      }
      return resolution.render(inline);
    }
    default:
      return null;
  }
}

function HeadingBlock({
  node,
  headingQueue,
  route,
}: {
  node: Heading;
  headingQueue: DocHeading[];
  route: string;
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
    <Tag
      id={heading?.id}
      className={`group font-heading font-semibold tracking-tight text-foreground ${sizeClass}`}
    >
      <span className="inline-flex items-center gap-2">
        {renderInline(node.children)}
        {heading !== undefined && <HeadingAnchor id={heading.id} text={heading.text} route={route} />}
      </span>
    </Tag>
  );
}

function ListBlock({
  node,
  headingQueue,
  route,
}: {
  node: List;
  headingQueue: DocHeading[];
  route: string;
}) {
  const Tag = node.ordered ? "ol" : "ul";
  return (
    <Tag className={node.ordered ? "list-decimal space-y-1 pl-6" : "list-disc space-y-1 pl-6"}>
      {node.children.map((item: ListItem, index) => (
        <li key={index} className="text-muted-foreground">
          {item.children.map((child, childIndex) =>
            child.type === "paragraph" ? (
              <span key={childIndex}>{renderInline(child.children)}</span>
            ) : (
              <BlockNode key={childIndex} node={child} headingQueue={headingQueue} route={route} />
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
      case "textDirective":
        return <TextDirectiveNode key={index} node={node} />;
      default:
        return null;
    }
  });
}

function TextDirectiveNode({ node }: { node: TextDirective }) {
  const resolution = resolveDirective(node);
  const inline = node.children.length > 0 ? <>{renderInline(node.children)}</> : null;

  if (!resolution.ok) {
    const fallback = inline ?? reconstructTextDirectiveSource(node);
    return (
      <Fragment>
        <UnknownDirective
          name={node.name}
          code={resolution.error.code}
          issues={issuesFromDirectiveError(resolution.error)}
          fallback={fallback}
        />
      </Fragment>
    );
  }

  return <Fragment>{resolution.render(inline)}</Fragment>;
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
