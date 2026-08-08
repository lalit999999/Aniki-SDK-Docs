/**
 * `POST /api/admin/auth/logout` - clears the admin session cookie.
 *
 * Idempotent and always `200` for a caller who is actually reaching this
 * handler (with or without an existing session, the outcome a client
 * cares about - "I am no longer logged in" - holds either way). The
 * fail-closed 404 still applies when the panel itself is disabled or
 * misconfigured, consistent with every other `/api/admin/*` handler.
 */

import { cookies } from "next/headers";

import { loadAdminConfig } from "@/lib/admin/config";
import { SESSION_COOKIE_NAME, clearSessionCookie } from "@/lib/admin/session";

export const dynamic = "force-dynamic";

function notFoundResponse(): Response {
  return Response.json({ error: { code: "NOT_FOUND", message: "not found" } }, { status: 404 });
}

export async function POST(): Promise<Response> {
  try {
    loadAdminConfig();
  } catch {
    return notFoundResponse();
  }

  try {
    const cleared = clearSessionCookie();
    (await cookies()).set(SESSION_COOKIE_NAME, cleared.value, cleared.cookieOptions);
  } catch {
    // Clearing a cookie should never fail, but logout reporting success is
    // the one outcome this endpoint must not fail to deliver - a client
    // that thinks it's still logged in when it isn't is a worse failure
    // mode than a cookie that technically outlives this response.
  }

  return Response.json({ ok: true }, { status: 200 });
}
