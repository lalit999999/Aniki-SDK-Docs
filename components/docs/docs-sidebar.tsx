import { Badge } from "@/components/ui/badge";
import { DocsSidebarNav } from "@/components/docs/docs-sidebar-nav";
import type { DocNavCategory } from "@/lib/content";
import type { DocsVersion } from "@/lib/versions";

/**
 * Desktop sidebar: sticky below the header, independently scrollable so a
 * long nav list never pushes the footer down. Hidden below `lg` - the
 * mobile drawer (`DocsNavMobile`/`MobileSidebar`) covers small viewports
 * instead.
 *
 * `version` is optional so existing callers that haven't been touched by
 * the versioning work keep compiling; every docs page passes it (D8-style
 * additive parameter), and the sidebar shows a small label above the
 * category list when it's present.
 */
export function DocsSidebar({ nav, version }: { nav: DocNavCategory[]; version?: DocsVersion }) {
  return (
    <aside className="sticky top-[var(--header-height)] hidden h-[calc(100svh-var(--header-height))] shrink-0 overflow-y-auto border-r border-border py-8 pr-6 lg:block">
      {version !== undefined && (
        <div className="mb-4 flex items-center gap-2">
          <span className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Version</span>
          <Badge variant={version.status === "latest" ? "secondary" : "outline"}>{version.label}</Badge>
        </div>
      )}
      <DocsSidebarNav nav={nav} />
    </aside>
  );
}
