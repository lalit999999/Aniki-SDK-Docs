import { Skeleton } from "@/components/ui/skeleton";

/**
 * Skeleton matching the real content layout, so navigating between docs
 * pages doesn't cause a layout shift while the next page streams in.
 */
export default function DocsLoading() {
  return (
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
  );
}
