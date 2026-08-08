"use client";

import Link from "next/link";

import { Button } from "@/components/ui/button";

/**
 * Error boundary for everything under `/admin`. Renders no message or
 * stack from `error` - only its `digest`, a safe correlation id Next
 * generates - since this project has no error-tracking sink to log to,
 * and this is the one part of the site a raw error message must not leak
 * internal detail from.
 */
export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-4 py-24 text-center">
      <h1 className="font-heading text-2xl font-bold text-foreground">Something went wrong</h1>
      <p className="mt-2 text-muted-foreground">
        The admin panel hit an unexpected error. You can try again, or head back to the dashboard.
      </p>
      {error.digest !== undefined && <p className="mt-2 text-xs text-muted-foreground">Reference: {error.digest}</p>}
      <div className="mt-6 flex items-center justify-center gap-3">
        <Button onClick={reset}>Try again</Button>
        <Button variant="outline" asChild>
          <Link href="/admin">Back to dashboard</Link>
        </Button>
      </div>
    </div>
  );
}
