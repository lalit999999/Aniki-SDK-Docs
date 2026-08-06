import { Skeleton } from "@/components/ui/skeleton";

/**
 * Skeleton matching the real changelog layout, so navigating to
 * `/changelog` doesn't cause a layout shift while releases stream in.
 */
export default function ChangelogLoading() {
  return (
    <div className="mx-auto w-full max-w-3xl flex-1 px-4 py-12 sm:px-6 lg:px-8">
      <Skeleton className="mb-3 h-9 w-1/2" />
      <Skeleton className="mb-10 h-6 w-2/3" />
      <div className="flex flex-col gap-6">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="rounded-lg border border-border p-6">
            <Skeleton className="mb-4 h-6 w-1/3" />
            <Skeleton className="mb-2 h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        ))}
      </div>
    </div>
  );
}
