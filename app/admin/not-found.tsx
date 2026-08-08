import Link from "next/link";

/**
 * Rendered whenever `notFound()` fires under `/admin` - most often
 * `app/admin/layout.tsx`'s fail-closed gate when the panel is disabled or
 * misconfigured. Deliberately identical in content to the site's root 404
 * (`app/not-found.tsx`) rather than anything admin-flavored: the whole
 * point of the fail-closed rule is that a disabled panel must be
 * indistinguishable from a URL that was never a route at all, and an
 * admin-branded 404 would itself be the tell.
 */
export default function AdminNotFound() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-4 py-24 text-center">
      <p className="text-sm font-semibold text-primary">404</p>
      <h1 className="mt-2 font-heading text-3xl font-bold text-foreground">Page not found</h1>
      <p className="mt-2 text-muted-foreground">The page you&apos;re looking for doesn&apos;t exist.</p>
      <Link href="/" className="mt-6 inline-block text-sm font-medium text-primary underline underline-offset-2">
        Back home
      </Link>
    </div>
  );
}
