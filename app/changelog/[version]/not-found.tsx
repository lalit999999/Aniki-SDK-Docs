import Link from "next/link";

/**
 * Rendered when `generateStaticParams` didn't produce the requested
 * release version (`dynamicParams = false` in `page.tsx` guarantees this
 * runs instead of a runtime render attempt).
 */
export default function ReleaseNotFound() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-4 py-24 text-center">
      <p className="text-sm font-semibold text-primary">404</p>
      <h1 className="mt-2 font-heading text-2xl font-bold text-foreground">Release not found</h1>
      <p className="mt-2 text-muted-foreground">This release doesn&apos;t exist.</p>
      <Link href="/changelog" className="mt-6 inline-block text-sm font-medium text-primary underline underline-offset-2">
        Back to changelog
      </Link>
    </div>
  );
}
