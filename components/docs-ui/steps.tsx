import { Children, isValidElement } from "react";
import type { ReactElement, ReactNode } from "react";

interface StepPanelProps {
  title?: string;
  children?: ReactNode;
}

/**
 * The `:::step{title="..."}` marker `Steps` reads back out of its
 * `children` via `React.Children`, the same compound-component pattern
 * `DocTabs`/`TabPanel` use (T6) - a `step` is never independently
 * dispatched or rendered on its own outside a `steps` wrapper (D3). Its
 * body still renders through the ordinary `containerDirective` recursion
 * in `markdown-nodes.tsx` like any other directive, which is what lets a
 * heading buried inside a step keep consuming the shared heading queue in
 * document order (D6) with no special-casing here.
 */
export function StepPanel({ children }: StepPanelProps) {
  return <>{children}</>;
}

/**
 * `::::steps` over a semantic `<ol>` (D15) with a connecting rail and
 * numbered markers. Numbering comes from array position, not an
 * author-supplied index, so reordering or inserting a step never requires
 * renumbering the rest by hand. Titles come from the `title` attribute or
 * the D8 directive label - already resolved generically before this
 * component ever runs (`resolveDirective`'s label-into-`attrs.title`
 * merge), so `StepPanel`'s own schema only needs to declare the field.
 *
 * The rail is one absolutely-positioned element spanning `top`-to-`bottom`
 * of the whole list (not measured per-segment), so it stretches correctly
 * regardless of how tall any individual step's body is, and stops exactly
 * at the list's own edges - never a trailing segment past the last marker.
 * A single step renders no rail at all, since there is nothing to connect.
 *
 * A Server Component: nothing here is interactive.
 *
 * @example
 * ```md
 * ::::steps
 * :::step{title="Install"}
 * ```bash
 * npm install @aniki/sdk
 * ```
 * :::
 * :::step{title="Configure"}
 * Add your API key to `.env`.
 * :::
 * ::::
 * ```
 */
export function Steps({ children }: { children?: ReactNode }) {
  const items = Children.toArray(children).filter(
    (child): child is ReactElement<StepPanelProps> => isValidElement(child),
  );

  if (items.length === 0) {
    return null;
  }

  return (
    <ol className="relative flex flex-col gap-8">
      {items.length > 1 && (
        <div aria-hidden="true" className="absolute top-3 bottom-3 left-[15px] w-px bg-border" />
      )}
      {items.map((item, index) => (
        <li key={index} className="relative flex gap-4">
          <span className="relative z-10 flex size-8 shrink-0 items-center justify-center rounded-full border border-border bg-background text-sm font-semibold text-foreground">
            {index + 1}
          </span>
          <div className="min-w-0 flex-1 space-y-4 pt-1">
            {item.props.title !== undefined && (
              <p className="font-heading font-medium text-foreground">{item.props.title}</p>
            )}
            {item}
          </div>
        </li>
      ))}
    </ol>
  );
}
