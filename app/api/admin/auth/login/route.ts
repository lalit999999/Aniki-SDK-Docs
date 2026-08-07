/**
 * `POST /api/admin/auth/login` - the only route that turns a username and
 * password into a session cookie.
 *
 * `proxy.ts` lets this path through unauthenticated (an anonymous caller
 * has to be able to reach it), so this handler is the actual boundary:
 * panel-enabled check, then rate-limit check, then credential
 * verification, then - only once all three pass - issuing the cookie
 * (D-fail-closed order). Every failure mode funnels through one
 * try/catch that maps each `AdminError` subclass to its HTTP status, with
 * a generic 500 for anything else, so nothing internal ever leaks into a
 * response body.
 */

import { cookies } from "next/headers";
import { z } from "zod";

import { loadAdminConfig } from "@/lib/admin/config";
import { verifyCredentials } from "@/lib/admin/credentials";
import { AdminConfigError, AdminDisabledError, InvalidCredentialsError, RateLimitedError } from "@/lib/admin/errors";
import { checkLimit, clearAttempts, recordFailure } from "@/lib/admin/rate-limit";
import { SESSION_COOKIE_NAME, issueSession } from "@/lib/admin/session";

export const dynamic = "force-dynamic";

const loginRequestSchema = z.object({
  username: z.string().min(1, "username is required"),
  password: z.string().min(1, "password is required"),
});

function clientIpFrom(request: Request): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  const first = forwardedFor?.split(",")[0]?.trim();
  return first !== undefined && first.length > 0 ? first : "unknown";
}

function notFoundResponse(): Response {
  return Response.json({ error: { code: "NOT_FOUND", message: "not found" } }, { status: 404 });
}

function internalErrorResponse(): Response {
  return Response.json({ error: { code: "ADMIN_INTERNAL_ERROR", message: "internal error" } }, { status: 500 });
}

export async function POST(request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json(
      { error: { code: "ADMIN_BAD_REQUEST", message: "request body must be JSON" } },
      { status: 400 },
    );
  }

  const parsedBody = loginRequestSchema.safeParse(body);
  if (!parsedBody.success) {
    const issues = parsedBody.error.issues.map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`);
    return Response.json(
      { error: { code: "ADMIN_BAD_REQUEST", message: "invalid request body", issues } },
      { status: 400 },
    );
  }
  const { username, password } = parsedBody.data;

  try {
    const config = loadAdminConfig();
    const key = `${username}:${clientIpFrom(request)}`;

    const limit = checkLimit(key);
    if (!limit.allowed) {
      throw new RateLimitedError("too many login attempts", { retryAfterSeconds: limit.retryAfterSeconds });
    }

    const result = await verifyCredentials(username, password, config);
    if (!result.ok) {
      recordFailure(key);
      throw new InvalidCredentialsError("invalid credentials", { username });
    }
    clearAttempts(key);

    const issued = await issueSession(result.username, config);
    (await cookies()).set(SESSION_COOKIE_NAME, issued.value, issued.cookieOptions);

    return Response.json(
      {
        username: result.username,
        expiresAt: new Date(Date.now() + config.sessionTtlSeconds * 1000).toISOString(),
      },
      { status: 200 },
    );
  } catch (error) {
    if (error instanceof AdminDisabledError || error instanceof AdminConfigError) {
      return notFoundResponse();
    }
    if (error instanceof RateLimitedError) {
      return Response.json(
        { error: { code: error.code, message: "too many attempts" } },
        { status: 429, headers: { "Retry-After": String(error.context.retryAfterSeconds) } },
      );
    }
    if (error instanceof InvalidCredentialsError) {
      return Response.json({ error: { code: error.code, message: "invalid credentials" } }, { status: 401 });
    }
    return internalErrorResponse();
  }
}
