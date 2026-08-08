import { inspectVersions, mapVersionsAdminError, requireVersionsAdmin } from "@/lib/admin/versions";

/**
 * Reads cookies and the live content index on every request - this route
 * must never be prerendered or cached (T4 in Prompt A's glob test covers
 * every `app/api/admin/**` handler).
 */
export const dynamic = "force-dynamic";

/**
 * Returns the version registry inspection report (drift plus per-version
 * counts and routing facts) for `/admin/versions`. Requires an admin
 * session; every failure path - unauthorized or otherwise - goes through
 * {@link mapVersionsAdminError} so this route and the scaffold route below
 * respond identically to the same kind of failure.
 */
export async function GET(): Promise<Response> {
  try {
    await requireVersionsAdmin();
    const report = await inspectVersions();
    return Response.json(report);
  } catch (error) {
    const { status, body } = mapVersionsAdminError(error);
    return Response.json(body, { status });
  }
}
