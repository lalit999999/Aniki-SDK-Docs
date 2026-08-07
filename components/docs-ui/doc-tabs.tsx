"use client";

import { Children, isValidElement, useEffect, useState } from "react";
import type { ReactElement, ReactNode } from "react";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useMounted } from "@/hooks/use-mounted";
import { readTabPreference, resolveTabPreference, writeTabPreference } from "@/lib/doc-components/tab-preference";

interface TabPanelProps {
  label: string;
  children?: ReactNode;
}

/**
 * Cross-instance, same-page live sync for `sync`-keyed tab groups. Writing
 * to `localStorage` alone doesn't notify sibling instances mounted in the
 * same tab/window - the browser's `storage` event only fires in *other*
 * tabs/windows - so this tiny module-scoped bus broadcasts a selection
 * change to every other mounted `DocTabs` sharing the same `sync` key,
 * while `tab-preference.ts`'s storage functions still handle persistence
 * across a reload.
 */
const tabSyncBus = new EventTarget();

function panelsOf(children: ReactNode): ReactElement<TabPanelProps>[] {
  return Children.toArray(children).filter(
    (child): child is ReactElement<TabPanelProps> => isValidElement(child),
  );
}

/**
 * The `:::tab{label="..."}` marker `DocTabs` reads back out of its
 * `children` via `React.Children` - a standard compound-component pattern.
 * It renders its own body verbatim and exists only so a `label` prop
 * survives on the element `DocTabs` inspects; a `tab` is never
 * independently dispatched or rendered on its own outside a `tabs`
 * wrapper (D3), and by the time this runs, `resolveDirective` has already
 * rejected a `tabs` container with a missing label or a non-`tab` child.
 */
export function TabPanel({ children }: TabPanelProps) {
  return <>{children}</>;
}

/**
 * `::::tabs{sync="..."}` over `components/ui/tabs`. Radix supplies
 * keyboard navigation and focus handling for free (D15) - this component
 * only manages which panel is selected.
 *
 * SSR and the first client render always select the first tab; a stored
 * `sync` preference is only adopted in an effect after mount (D12), so
 * hydration never has to reconcile a value the server couldn't have known.
 * Radix's `value` is a stable positional id (`"tab-0"`, ...) rather than
 * the label itself, since two tabs could in principle share a label -
 * persistence and cross-group sync are keyed by the label text instead,
 * which is what stays meaningful across groups with a different tab order.
 *
 * @example
 * ```md
 * ::::tabs{sync="pkg"}
 * :::tab{label="npm"}
 * ```bash
 * npm install
 * ```
 * :::
 * :::tab{label="pnpm"}
 * ```bash
 * pnpm add
 * ```
 * :::
 * ::::
 * ```
 */
export function DocTabs({ sync, children }: { sync?: string; children?: ReactNode }) {
  const panels = panelsOf(children);
  const labels = panels.map((panel) => panel.props.label);
  const values = panels.map((_, index) => `tab-${index}`);
  const [value, setValue] = useState(values[0]);
  const mounted = useMounted();

  useEffect(() => {
    if (!mounted || sync === undefined) {
      return;
    }

    const currentLabels = panelsOf(children).map((panel) => panel.props.label);

    function selectByLabel(label: string): void {
      const index = currentLabels.indexOf(label);
      if (index !== -1) {
        setValue(`tab-${index}`);
      }
    }

    const stored = readTabPreference(window.localStorage, sync);
    selectByLabel(resolveTabPreference(stored, currentLabels, currentLabels[0]));

    function handleSync(event: Event): void {
      selectByLabel((event as CustomEvent<string>).detail);
    }
    tabSyncBus.addEventListener(sync, handleSync);
    return () => tabSyncBus.removeEventListener(sync, handleSync);
  }, [mounted, sync, children]);

  function handleValueChange(nextValue: string): void {
    setValue(nextValue);
    if (sync === undefined) {
      return;
    }
    const label = labels[values.indexOf(nextValue)];
    if (label !== undefined) {
      writeTabPreference(window.localStorage, sync, label);
      tabSyncBus.dispatchEvent(new CustomEvent(sync, { detail: label }));
    }
  }

  if (panels.length === 0) {
    return null;
  }

  return (
    <Tabs value={value} onValueChange={handleValueChange}>
      <TabsList>
        {panels.map((_, index) => (
          <TabsTrigger key={values[index]} value={values[index]}>
            {labels[index]}
          </TabsTrigger>
        ))}
      </TabsList>
      {panels.map((panel, index) => (
        <TabsContent key={values[index]} value={values[index]}>
          {panel}
        </TabsContent>
      ))}
    </Tabs>
  );
}
