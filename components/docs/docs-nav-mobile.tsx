import { MobileSidebar } from "@/components/docs/mobile-sidebar";
import type { DocNavCategory } from "@/lib/content";
import type { DocsVersion } from "@/lib/versions";

/**
 * Small `lg:hidden` bar at the top of a docs page's content column,
 * carrying the mobile drawer trigger and the active version's label. Below
 * `lg` the persistent `DocsSidebar` is hidden (see its own `hidden lg:block`),
 * so this is the only way to reach the documentation nav on small
 * viewports - it used to live in the site header, but the header no longer
 * receives version-scoped navigation data (D12), only a page does.
 */
export function DocsNavMobile({ nav, version }: { nav: DocNavCategory[]; version: DocsVersion }) {
  return (
    <div className="col-span-full flex items-center justify-between border-b border-border py-3 lg:hidden">
      <MobileSidebar nav={nav} />
      <span className="text-sm font-medium text-muted-foreground">{version.label}</span>
    </div>
  );
}
