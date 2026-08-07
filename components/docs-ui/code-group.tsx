"use client";

import { Children, cloneElement, isValidElement, useState } from "react";
import type { ReactElement, ReactNode } from "react";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import type { CodeBlockProps } from "./code-block";

function panelsOf(children: ReactNode): ReactElement<CodeBlockProps>[] {
  return Children.toArray(children).filter(
    (child): child is ReactElement<CodeBlockProps> => isValidElement(child),
  );
}

/**
 * `::::code-group` over `components/ui/tabs`. Each child is an ordinary
 * fenced code block, already rendered as a `CodeBlock` element by
 * `MarkdownNodes`'s `code` case before `CodeGroup` ever sees it - no
 * mdast-aware machinery here (D3), just `React.Children` reading each
 * panel's `title`/`lang` back off the elements it was handed and
 * re-cloning them with `showHeader: false`, since the tab strip itself
 * already names each panel and a second title directly above it would
 * read as a duplicate.
 *
 * No persistence: unlike `sync`-keyed tabs, a code group's selection isn't
 * meaningful to remember across a reload, and the grammar table doesn't
 * ask for it.
 *
 * @example
 * ```md
 * ::::code-group
 * ```bash title="npm"
 * npm install
 * ```
 * ```bash title="pnpm"
 * pnpm add
 * ```
 * ::::
 * ```
 */
export function CodeGroup({ children }: { children?: ReactNode }) {
  const panels = panelsOf(children);
  const labels = panels.map((panel, index) => panel.props.title ?? panel.props.lang ?? `code ${index + 1}`);
  const values = panels.map((_, index) => `panel-${index}`);
  const [value, setValue] = useState(values[0]);

  if (panels.length === 0) {
    return null;
  }

  return (
    <Tabs value={value} onValueChange={setValue}>
      <TabsList>
        {panels.map((_, index) => (
          <TabsTrigger key={values[index]} value={values[index]}>
            {labels[index]}
          </TabsTrigger>
        ))}
      </TabsList>
      {panels.map((panel, index) => (
        <TabsContent key={values[index]} value={values[index]}>
          {cloneElement(panel, { showHeader: false })}
        </TabsContent>
      ))}
    </Tabs>
  );
}
