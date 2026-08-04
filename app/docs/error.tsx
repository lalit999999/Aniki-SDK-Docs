"use client";

import { useEffect } from "react";

import { Button } from "@/components/ui/button";

/**
 * Error boundary for everything under `/docs`. Logs the digest for
 * correlation with server logs but never surfaces the raw error/stack to
 * the user.
 */
export default function DocsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error.digest ?? error.message);
  }, [error]);

  return (
    <div className="min-w-0 py-16 text-center xl:col-span-2">
      <h1 className="font-heading text-2xl font-bold text-foreground">Something went wrong</h1>
      <p className="mt-2 text-muted-foreground">
        This documentation page failed to load. You can try again, or head back to the docs home.
      </p>
      <Button onClick={reset} className="mt-6">
        Try again
      </Button>
    </div>
  );
}
