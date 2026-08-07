/**
 * `GET /api/admin/auth/session` - reports whether the current request
 * carries a valid admin session, for the login page's already-authenticated
 * redirect and any future client-side "am I still logged in" check.
 *
 * Never `500`s: an anonymous caller (no cookie, expired cookie, tampered
 * cookie) is not an error, so it gets the same `200` shape as an
 * authenticated one, just with `authenticated: false`.
 */

import { loadAdminConfig } from "@/lib/admin/config";
import { readSession } from "@/lib/admin/session";

export const dynamic = "force-dynamic";

function notFoundResponse(): Response {
  return Response.json({ error: { code: "NOT_FOUND", message: "not found" } }, { status: 404 });
}

function anonymousResponse(): Response {
  return Response.json({ authenticated: false }, { status: 200 });
}

export async function GET(): Promise<Response> {
  try {
    loadAdminConfig();
  } catch {
    return notFoundResponse();
  }

  try {
    const session = await readSession();
    if (session === null) {
      return anonymousResponse();
    }
    return Response.json(
      { authenticated: true, username: session.username, expiresAt: session.expiresAt },
      { status: 200 },
    );
  } catch {
    // readSession() is documented to never throw; this guard exists so
    // "never 500s" holds even if that invariant is ever violated.
    return anonymousResponse();
  }
}
