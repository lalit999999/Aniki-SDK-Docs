import { DocsSidebar } from "@/components/docs/docs-sidebar";
import { ReadingProgress } from "@/components/docs/reading-progress";
import { getDocNavigation } from "@/lib/content";

/**
 * Shared shell for every route under `/docs`: sidebar + content + (when a
 * page renders one) a right-hand table of contents.
 *
 * The grid is defined here with three column tracks from `xl` up, two from
 * `lg`, and one below that (sidebar becomes the mobile drawer in the
 * header instead). Only the sidebar is rendered directly - `children` is
 * whatever the page renders. A page that also renders a `TableOfContents`
 * as a sibling element (not nested inside its own content wrapper) gets it
 * placed in the third column automatically, since a fragment's top-level
 * children flatten into this same grid; a page with no TOC (the docs
 * index) spans the remaining columns itself.
 */
export default async function DocsLayout({ children }: { children: React.ReactNode }) {
  const nav = await getDocNavigation();

  return (
    <div className="flex flex-1 flex-col">
      <ReadingProgress />
      <div className="mx-auto grid w-full max-w-7xl flex-1 grid-cols-1 gap-8 px-4 sm:px-6 lg:grid-cols-[16rem_minmax(0,1fr)] lg:px-8 xl:grid-cols-[16rem_minmax(0,1fr)_16rem]">
        <DocsSidebar nav={nav} />
        {children}
      </div>
    </div>
  );
}
