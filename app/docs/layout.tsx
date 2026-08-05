import { ReadingProgress } from "@/components/docs/reading-progress";

/**
 * Shared shell for every route under `/docs`: the reading-progress bar and
 * a three-column grid (sidebar / content / table of contents at `xl`, two
 * columns at `lg`, one below that).
 *
 * A root/shared layout receives no route params (D12), so it cannot know
 * which documentation version's sidebar to render - `/docs/v1/*` and
 * `/docs/*` need different navigation, and only a page component knows
 * which one it is. `DocsSidebar` therefore moved out of this layout: every
 * page under `/docs` renders it itself as the first child of the fragment
 * it returns, and a fragment's top-level children flatten into this same
 * grid, landing the sidebar in column one exactly as it did when this
 * layout rendered it directly. A page with no sidebar (an error/loading/
 * not-found boundary) uses `col-span-full` instead, spanning whatever
 * track count applies at the current breakpoint.
 */
export default function DocsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-1 flex-col">
      <ReadingProgress />
      <div className="mx-auto grid w-full max-w-7xl flex-1 grid-cols-1 gap-8 px-4 sm:px-6 lg:grid-cols-[16rem_minmax(0,1fr)] lg:px-8 xl:grid-cols-[16rem_minmax(0,1fr)_16rem]">
        {children}
      </div>
    </div>
  );
}
