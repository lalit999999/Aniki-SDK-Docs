import Link from "next/link";

/**
 * Rendered when `generateStaticParams` didn't produce the requested path,
 * or `resolveDocsPath` couldn't resolve it at all (`dynamicParams = false`
 * in `page.tsx` guarantees this runs instead of a runtime render attempt).
 */
export default function DocNotFound() {
  return (
    <div className="col-span-full min-w-0 py-16 text-center">
      <p className="text-sm font-semibold text-primary">404</p>
      <h1 className="mt-2 font-heading text-2xl font-bold text-foreground">Page not found</h1>
      <p className="mt-2 text-muted-foreground">This documentation page doesn&apos;t exist.</p>
      <Link href="/docs" className="mt-6 inline-block text-sm font-medium text-primary underline underline-offset-2">
        Back to documentation
      </Link>
    </div>
  );
}
