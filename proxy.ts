/**
 * Request interception for the admin panel (Next 16 renamed
 * `middleware.ts` to `proxy.ts`; this is that file).
 *
 * This is UX routing, not a security boundary (D3). It redirects
 * anonymous browser navigation away from `/admin/*` and returns a fast
 * `401`/`404` for `/api/admin/*` so a logged-out visitor never sees a
 * flash of protected UI - nothing more. It grants no access: every admin
 * page and every privileged route handler independently calls
 * `requireAdminSession()` (see `lib/admin/session.ts`) and must keep
 * working correctly even if this file were deleted outright. Next.js
 * middleware has shipped a real authorization bypass before
 * (CVE-2025-29927, an `x-middleware-subrequest` header that skipped
 * middleware entirely) and Next's own docs now say the same thing this
 * file's design assumes: never treat middleware as the only check.
 *
 * Also strips any inbound `x-aniki-admin` header before forwarding a
 * request, so a client cannot plant a header that some future downstream
 * code might mistakenly trust as a signal of admin identity - there is no
 * such signal today, but a header name reserved for one is worth
 * scrubbing pre-emptively rather than after something starts reading it.
 */

import { NextResponse, type NextRequest } from "next/server";

import { loadAdminConfig } from "@/lib/admin/config";
import { UnauthorizedError } from "@/lib/admin/errors";
import { SESSION_COOKIE_NAME, verifySessionToken } from "@/lib/admin/session";
import type { AdminConfig } from "@/lib/admin/types";

const SPOOFABLE_HEADER = "x-aniki-admin";

/** `/admin/*` paths reachable without a session - just the login page
 * itself, so an anonymous visitor can reach the form that lets them stop
 * being anonymous. */
const PUBLIC_ADMIN_PAGE = "/admin/login";

/** `/api/admin/*` paths reachable without a session. Not spelled out in
 * behavioural terms anywhere else in this spec, but required by it
 * implicitly: a login endpoint an anonymous caller cannot reach can never
 * be used to log in, and the logout/session-check endpoints must stay
 * safely callable by a visitor who was never authenticated (or whose
 * session already expired) in the first place. */
const PUBLIC_API_PREFIX = "/api/admin/auth/";

function isPublicPath(pathname: string): boolean {
  return (
    pathname === PUBLIC_ADMIN_PAGE || pathname.startsWith(PUBLIC_API_PREFIX)
  );
}

function forward(request: NextRequest): NextResponse {
  const headers = new Headers(request.headers);
  headers.delete(SPOOFABLE_HEADER);
  return NextResponse.next({ request: { headers } });
}

function isPublicApiPath(pathname: string): boolean {
  return pathname.startsWith(PUBLIC_API_PREFIX);
}

function notFound(): NextResponse {
  // Deliberately a bare 404 with no body, for pages and API routes alike
  // (D-fail-closed) - a JSON error envelope would itself be a signal that
  // something admin-shaped lives at this path.
  return new NextResponse(null, { status: 404 });
}

function unauthorizedJson(): NextResponse {
  const { code, message } = new UnauthorizedError(
    "authentication required",
  ).toJSON();
  return NextResponse.json({ error: { code, message } }, { status: 401 });
}

function redirectToLogin(request: NextRequest): NextResponse {
  const loginUrl = new URL(PUBLIC_ADMIN_PAGE, request.url);
  loginUrl.searchParams.set("next", request.nextUrl.pathname);
  return NextResponse.redirect(loginUrl, 307);
}

export default async function proxy(
  request: NextRequest,
): Promise<NextResponse> {
  const { pathname } = request.nextUrl;
  const isApiRequest = pathname.startsWith("/api/admin/");

  if (isPublicApiPath(pathname)) {
    return forward(request);
  }

  let config: AdminConfig;
  try {
    config = loadAdminConfig();
  } catch {
    return notFound();
  }

  if (isPublicPath(pathname)) {
    return forward(request);
  }

  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session =
    token !== undefined ? await verifySessionToken(token, config) : null;

  if (session !== null) {
    return forward(request);
  }

  return isApiRequest ? unauthorizedJson() : redirectToLogin(request);
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};
