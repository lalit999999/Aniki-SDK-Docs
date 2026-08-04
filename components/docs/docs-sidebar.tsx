import { DocsSidebarNav } from "@/components/docs/docs-sidebar-nav";
import type { DocNavCategory } from "@/lib/content";

/**
 * Desktop sidebar: sticky below the header, independently scrollable so a
 * long nav list never pushes the footer down. Hidden below `lg` - the
 * mobile drawer (`MobileSidebar`) covers small viewports instead.
 */
export function DocsSidebar({ nav }: { nav: DocNavCategory[] }) {
  return (
    <aside className="sticky top-[var(--header-height)] hidden h-[calc(100svh-var(--header-height))] shrink-0 overflow-y-auto border-r border-border py-8 pr-6 lg:block">
      <DocsSidebarNav nav={nav} />
    </aside>
  );
}
