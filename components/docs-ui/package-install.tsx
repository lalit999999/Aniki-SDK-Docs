"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usePackageManager } from "@/hooks/use-package-manager";
import { buildInstallCommand, PACKAGE_MANAGERS } from "@/lib/doc-components/package-managers";
import type { PackageManager } from "@/lib/doc-components/package-managers";

import { CopyButton } from "./copy-button";

const MANAGER_LABEL: Record<PackageManager, string> = {
  npm: "npm",
  pnpm: "pnpm",
  yarn: "yarn",
  bun: "bun",
};

/**
 * `::package-install{name dev global exec}` - a package-manager switcher
 * over `buildInstallCommand`'s per-manager output, one `CopyButton` per
 * panel. Built directly on the same `components/ui/tabs` primitives
 * `DocTabs` (Part 2) uses, rather than a second tab implementation - but
 * not on `DocTabs` itself, since that component reads its tab set back out
 * of markdown-authored `:::tab` children (D3's compound-component pattern
 * for directive bodies), which doesn't fit a leaf directive with no body
 * at all. The four panels here are generated from `PACKAGE_MANAGERS`, not
 * authored content, so this owns its own (much smaller) `Tabs` wiring,
 * controlled by `usePackageManager` instead of `DocTabs`'s internal
 * `sync` state.
 *
 * The only client leaf this directive needs (D10): reading the persisted
 * preference is the entire reason for the boundary, and per §3.1/D12 it
 * always renders npm first (`usePackageManager`'s SSR/first-paint default)
 * so the server and the client agree before the stored preference is
 * adopted.
 *
 * @example
 * ```md
 * ::package-install{name="aniki-sdk" dev}
 * ```
 */
export function PackageInstall({
  name,
  dev,
  global,
  exec,
}: {
  /** Package names, already split from the directive's `name` attribute -
   * named to match that attribute rather than `packages`, since the attrs
   * object `resolveDirective` builds is passed straight through as props. */
  name: string[];
  dev?: boolean;
  global?: boolean;
  exec?: boolean;
}) {
  const { manager, setManager } = usePackageManager();

  return (
    <Tabs
      value={manager}
      onValueChange={(next) => setManager(next as PackageManager)}
      className="my-4"
    >
      <TabsList>
        {PACKAGE_MANAGERS.map((pm) => (
          <TabsTrigger key={pm} value={pm}>
            {MANAGER_LABEL[pm]}
          </TabsTrigger>
        ))}
      </TabsList>
      {PACKAGE_MANAGERS.map((pm) => {
        const result = buildInstallCommand({ manager: pm, packages: name, dev, global, exec });
        return (
          <TabsContent key={pm} value={pm}>
            {result.ok ? (
              <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-muted/30 px-4 py-3">
                <code className="min-w-0 flex-1 overflow-x-auto font-mono text-sm whitespace-pre text-foreground">
                  {result.command}
                </code>
                <CopyButton text={result.command} label={`Copy ${MANAGER_LABEL[pm]} command`} />
              </div>
            ) : (
              <p className="rounded-lg border border-dashed border-destructive/50 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                {result.issue}
              </p>
            )}
          </TabsContent>
        );
      })}
    </Tabs>
  );
}
