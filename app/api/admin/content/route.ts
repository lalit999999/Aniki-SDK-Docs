/**
 * `GET /api/admin/content?version=<id>` - lists every document (draft or
 * published) in a documentation version, for the content list page
 * (sub-task 7). Omitting `version` resolves the latest declared version.
 *
 * `POST /api/admin/content` - creates a new document. Body:
 * `{ version, slug, frontmatter, body }`.
 */

import { revalidatePath } from "next/cache";

import { slugToRoute } from "@/lib/content";
import { resolveVersionId } from "@/lib/versions";
import {
  createDocument,
  documentDraftRequestSchema,
  listDocuments,
  mapAdminContentErrorToResponse,
  requireContentAdmin,
} from "@/lib/admin/content";

export const dynamic = "force-dynamic";

function badRequest(message: string, issues?: readonly string[]): Response {
  return Response.json(
    { error: { code: "CONTENT_ADMIN_BAD_REQUEST", message, issues } },
    { status: 400 },
  );
}

export async function GET(request: Request): Promise<Response> {
  try {
    await requireContentAdmin();

    const url = new URL(request.url);
    const versionParam = url.searchParams.get("version") ?? undefined;
    const version = resolveVersionId(versionParam);

    const documents = await listDocuments(version);
    return Response.json({ version, documents }, { status: 200 });
  } catch (error) {
    return mapAdminContentErrorToResponse(error);
  }
}

export async function POST(request: Request): Promise<Response> {
  try {
    await requireContentAdmin();

    let json: unknown;
    try {
      json = await request.json();
    } catch {
      return badRequest("request body must be JSON");
    }

    const parsed = documentDraftRequestSchema.safeParse(json);
    if (!parsed.success) {
      const issues = parsed.error.issues.map(
        (issue) => `${issue.path.length > 0 ? issue.path.join(".") : "(root)"}: ${issue.message}`,
      );
      return badRequest("invalid request body", issues);
    }

    const result = await createDocument(parsed.data);
    revalidatePath("/docs", "layout");
    revalidatePath(slugToRoute(parsed.data.slug, parsed.data.version));

    return Response.json(result, { status: 201 });
  } catch (error) {
    return mapAdminContentErrorToResponse(error);
  }
}
