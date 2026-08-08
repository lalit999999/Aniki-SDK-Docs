import { z } from "zod";

import { mapVersionsAdminError, requireVersionsAdmin, scaffoldVersion } from "@/lib/admin/versions";

/**
 * Writes to `config/versions.ts` and copies a content directory on every
 * call - this route must never be prerendered or cached.
 */
export const dynamic = "force-dynamic";

/**
 * Shape-level validation only: presence and type of each field. Business
 * rules (id pattern and uniqueness, `releasedAt` format and ordering,
 * source version existence, `migrationGuideSlug` resolution) belong to
 * `validateNewVersionInput`/`scaffoldVersion`, which already aggregate
 * every violation into a single `InvalidVersionInputError` - duplicating
 * that logic here would just let the two drift apart.
 */
const scaffoldRequestSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  releasedAt: z.string().min(1),
  sourceVersionId: z.string().min(1),
  promoteToLatest: z.boolean(),
  migrationGuideSlug: z.string().min(1).optional(),
});

/**
 * Scaffolds a new documentation version (D4). Requires an admin session,
 * then a request body matching {@link scaffoldRequestSchema}. Every
 * failure - unauthorized, malformed body, invalid input, drift, or a
 * filesystem error mid-write - goes through `mapVersionsAdminError` for a
 * consistent status and body.
 */
export async function POST(request: Request): Promise<Response> {
  try {
    await requireVersionsAdmin();

    const json: unknown = await request.json().catch(() => null);
    const parsed = scaffoldRequestSchema.safeParse(json);
    if (!parsed.success) {
      return Response.json(
        { error: "invalid_input", issues: parsed.error.issues.map((issue) => issue.message) },
        { status: 400 },
      );
    }

    const result = await scaffoldVersion(parsed.data);
    return Response.json(result, { status: 201 });
  } catch (error) {
    const { status, body } = mapVersionsAdminError(error);
    return Response.json(body, { status });
  }
}
