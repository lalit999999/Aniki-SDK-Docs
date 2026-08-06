import { Skeleton } from "@/components/ui/skeleton";

/**
 * Skeleton matching the real content layout, so navigating between docs
 * pages doesn't cause a layout shift while the next page streams in.
 * Includes a sidebar skeleton (column one) since `DocsSidebar` is now
 * rendered by each page rather than the shared layout (D12) - without it,
 * the loading state would render one column narrower than the page it's
 * standing in for.
 */
export default function DocsLoading() {
  return (
    <>
      <aside className="hidden shrink-0 py-8 pr-6 lg:block" aria-hidden="true">
        <Skeleton className="mb-4 h-4 w-24" />
        <div className="flex flex-col gap-2">
          {Array.from({ length: 8 }).map((_, index) => (
            <Skeleton key={index} className="h-4 w-full" />
          ))}
        </div>
      </aside>
      <div className="min-w-0 py-8 xl:col-span-2">
        <Skeleton className="mb-6 h-9 w-2/3" />
        <div className="flex flex-col gap-3">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
          <Skeleton className="h-4 w-4/6" />
          <Skeleton className="mt-4 h-32 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </div>
      </div>
    </>
  );
}
