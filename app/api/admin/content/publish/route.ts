/**
 * `POST /api/admin/content/publish` - the D6 publish/unpublish state
 * transition. Body: `{ version, slug, action: "publish" | "unpublish" }`.
 */

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { slugToRoute } from "@/lib/content";
import {
  mapAdminContentErrorToResponse,
  publishDocument,
  requireContentAdmin,
  unpublishDocument,
} from "@/lib/admin/content";

export const dynamic = "force-dynamic";

function badRequest(message: string, issues?: readonly string[]): Response {
  return Response.json(
    { error: { code: "CONTENT_ADMIN_BAD_REQUEST", message, issues } },
    { status: 400 },
  );
}

const publishRequestSchema = z.object({
  version: z.string().min(1),
  slug: z.string().min(1),
  action: z.enum(["publish", "unpublish"]),
});

export async function POST(request: Request): Promise<Response> {
  try {
    await requireContentAdmin();

    let json: unknown;
    try {
      json = await request.json();
    } catch {
      return badRequest("request body must be JSON");
    }

    const parsed = publishRequestSchema.safeParse(json);
    if (!parsed.success) {
      const issues = parsed.error.issues.map(
        (issue) => `${issue.path.length > 0 ? issue.path.join(".") : "(root)"}: ${issue.message}`,
      );
      return badRequest("invalid request body", issues);
    }

    const { version, slug, action } = parsed.data;
    const result = action === "publish" ? await publishDocument(version, slug) : await unpublishDocument(version, slug);

    revalidatePath("/docs", "layout");
    revalidatePath(slugToRoute(slug, version));

    return Response.json(result, { status: 200 });
  } catch (error) {
    return mapAdminContentErrorToResponse(error);
  }
}
