import { HugeiconsIcon } from "@hugeicons/react";
import { File01Icon, Folder01Icon } from "@hugeicons/core-free-icons";

import { cn } from "@/lib/utils";
import type { FileTreeNode } from "@/lib/doc-components/file-tree";

/**
 * A project folder structure, parsed from an authored markdown list by
 * `parseFileTree` (`lib/doc-components/file-tree.ts`) rather than rendered
 * from directive children - see that module for why. A Server Component:
 * nothing here is interactive (D10).
 *
 * Renders as a genuinely nested `<ul>`/`<li>` tree (D15) with an
 * `aria-label`, not a div soup with visual-only indentation - a screen
 * reader can navigate it the same way it navigates any nested list.
 *
 * @example
 * ```tsx
 * const result = parseFileTree(bodyChildren);
 * if (result.ok) return <FileTree nodes={result.nodes} />;
 * ```
 */
export function FileTree({ nodes }: { nodes: FileTreeNode[] }) {
  return (
    <div className="my-4 overflow-x-auto rounded-lg border border-border bg-muted/20 p-4">
      <ul aria-label="File tree" className="min-w-max space-y-0.5 font-mono text-sm">
        {nodes.map((node, index) => (
          <FileTreeItem key={index} node={node} />
        ))}
      </ul>
    </div>
  );
}

function FileTreeItem({ node }: { node: FileTreeNode }) {
  const displayName = node.kind === "folder" ? `${node.name}/` : node.name;

  return (
    <li>
      <div
        className={cn(
          "flex items-center gap-2 rounded px-1.5 py-0.5 leading-6",
          node.highlighted && "bg-primary/10 font-semibold text-foreground",
        )}
      >
        <HugeiconsIcon
          icon={node.kind === "folder" ? Folder01Icon : File01Icon}
          strokeWidth={2}
          className={cn(
            "size-4 shrink-0",
            node.kind === "folder" ? "text-primary" : "text-muted-foreground",
          )}
        />
        <span className={cn("whitespace-nowrap", !node.highlighted && "text-foreground")}>
          {displayName}
        </span>
      </div>
      {node.children.length > 0 && (
        <ul className="ml-[calc(0.375rem+0.5rem)] space-y-0.5 border-l border-border pl-3">
          {node.children.map((child, index) => (
            <FileTreeItem key={index} node={child} />
          ))}
        </ul>
      )}
    </li>
  );
}
