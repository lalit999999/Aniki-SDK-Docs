import Link from "next/link";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * Sitemap entry count and an explicit list of what's excluded and why
 * (T6/T7) - drafts, deprecated pages, and non-latest versions must never
 * appear in `app/sitemap.ts`'s output, and a human auditing SEO should see
 * that stated plainly rather than have to infer it from an absence.
 */
export function SitemapStatusCard({ entryCount, generatedAt }: { entryCount: number; generatedAt: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Sitemap</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          <span className="font-medium text-foreground">{entryCount}</span> entries, computed live from the current
          content index as of this request ({generatedAt}) - not read from the deployed{" "}
          <code>/sitemap.xml</code>, which reflects the last build rather than this moment.
        </p>
        <div className="flex gap-4 text-sm">
          <Link href="/sitemap.xml" className="underline underline-offset-4 hover:text-foreground">
            /sitemap.xml
          </Link>
          <Link href="/robots.txt" className="underline underline-offset-4 hover:text-foreground">
            /robots.txt
          </Link>
        </div>
        <Alert>
          <AlertTitle>What&apos;s excluded, and why</AlertTitle>
          <AlertDescription>
            <ul className="ml-4 list-disc">
              <li>
                Draft pages (frontmatter <code>draft: true</code>) - hidden outside development.
              </li>
              <li>Deprecated pages - already marked noindex, so they must never be submitted for indexing.</li>
              <li>Non-latest documentation versions - already noindex, served at their prefixed URLs.</li>
            </ul>
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
}
