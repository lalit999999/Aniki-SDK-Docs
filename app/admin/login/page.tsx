import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { readSession } from "@/lib/admin/session";
import { LoginForm } from "@/components/admin/login-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { siteConfig } from "@/config/site";

/** Reads a session cookie every render - a cached login page could keep
 * showing the form to an operator who is, per a fresher request, already
 * signed in (D8). */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: `Sign in – ${siteConfig.name} Admin`,
  robots: { index: false, follow: false },
};

/**
 * Validates the `next` query param before it is ever handed to a redirect.
 * Only a same-origin path beginning with `/admin` is accepted; anything
 * else (an absolute URL, a bare domain, a path outside `/admin`) falls
 * back to `/admin`. This is the open-redirect guard the sub-task calls out
 * explicitly - `next` is attacker-controlled (it comes from the URL a
 * phished operator might click), and both this redirect and
 * `LoginForm`'s post-submit `router.push(next)` rely on this function
 * having already ruled out anything unsafe.
 */
function resolveNextPath(nextParam: string | undefined): string {
  if (nextParam === undefined || !nextParam.startsWith("/admin")) {
    return "/admin";
  }
  return nextParam;
}

/**
 * The admin login page. Deliberately outside `AdminShell`'s sidebar/topbar
 * chrome (see `components/admin/admin-shell.tsx`'s `/admin/login`
 * special-case) - there is nothing to navigate to before signing in.
 *
 * Does not itself call `requireAdminSession()`: an anonymous visitor
 * reaching this page is the expected case, not an error. It only reads
 * `readSession()` to skip the form when a valid session already exists.
 */
export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const rawNext = params.next;
  const next = resolveNextPath(typeof rawNext === "string" ? rawNext : undefined);

  const session = await readSession();
  if (session !== null) {
    redirect(next);
  }

  return (
    <div className="flex min-h-svh flex-1 items-center justify-center px-4 py-12">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Sign in</CardTitle>
          <CardDescription>{siteConfig.name} Admin</CardDescription>
        </CardHeader>
        <CardContent>
          <LoginForm next={next} />
        </CardContent>
      </Card>
    </div>
  );
}
