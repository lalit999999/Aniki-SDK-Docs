/**
 * `GET /api/admin/content/[version]/[slug]` - reads a single document.
 * `PUT /api/admin/content/[version]/[slug]` - updates it. Body:
 * `{ frontmatter, body }` (version/slug come from the route, not the body).
 * `DELETE /api/admin/content/[version]/[slug]` - deletes it. Body:
 * `{ slug }`, which must match the route's `slug` exactly (D8) - deleting a
 * docs page is destructive and unrecoverable from within the panel, so the
 * confirmation lives at the API boundary too, not only in the UI dialog.
 */

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { ContentNotFoundError, docFrontmatterSchema, slugToRoute } from "@/lib/content";
import {
  deleteDocument,
  mapAdminContentErrorToResponse,
  readStoredDocument,
  requireContentAdmin,
  updateDocument,
} from "@/lib/admin/content";
import type { DocumentDraft } from "@/lib/admin/content";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ version: string; slug: string }>;
}

function badRequest(message: string, issues?: readonly string[]): Response {
  return Response.json(
    { error: { code: "CONTENT_ADMIN_BAD_REQUEST", message, issues } },
    { status: 400 },
  );
}

const updateBodySchema = z.object({
  frontmatter: docFrontmatterSchema,
  body: z.string(),
});

const deleteBodySchema = z.object({ slug: z.string().min(1) });

export async function GET(_request: Request, { params }: RouteContext): Promise<Response> {
  try {
    await requireContentAdmin();
    const { version, slug } = await params;

    const doc = await readStoredDocument(version, slug);
    if (doc === null) {
      throw new ContentNotFoundError(`no document for slug "${slug}" in version "${version}"`, {
        slug,
        availableSlugs: [],
      });
    }

    return Response.json(doc, { status: 200 });
  } catch (error) {
    return mapAdminContentErrorToResponse(error);
  }
}

export async function PUT(request: Request, { params }: RouteContext): Promise<Response> {
  try {
    await requireContentAdmin();
    const { version, slug } = await params;

    let json: unknown;
    try {
      json = await request.json();
    } catch {
      return badRequest("request body must be JSON");
    }

    const parsed = updateBodySchema.safeParse(json);
    if (!parsed.success) {
      const issues = parsed.error.issues.map(
        (issue) => `${issue.path.length > 0 ? issue.path.join(".") : "(root)"}: ${issue.message}`,
      );
      return badRequest("invalid request body", issues);
    }

    const draft: DocumentDraft = { version, slug, frontmatter: parsed.data.frontmatter, body: parsed.data.body };
    const result = await updateDocument(draft);

    revalidatePath("/docs", "layout");
    revalidatePath(slugToRoute(slug, version));

    return Response.json(result, { status: 200 });
  } catch (error) {
    return mapAdminContentErrorToResponse(error);
  }
}

export async function DELETE(request: Request, { params }: RouteContext): Promise<Response> {
  try {
    await requireContentAdmin();
    const { version, slug } = await params;

    let json: unknown;
    try {
      json = await request.json();
    } catch {
      return badRequest("request body must be JSON");
    }

    const parsed = deleteBodySchema.safeParse(json);
    if (!parsed.success) {
      return badRequest("request body must include the slug to confirm deletion");
    }
    if (parsed.data.slug !== slug) {
      return badRequest(`confirmation slug "${parsed.data.slug}" does not match "${slug}"`);
    }

    const result = await deleteDocument(version, slug);

    revalidatePath("/docs", "layout");
    revalidatePath(slugToRoute(slug, version));

    return Response.json(result, { status: 200 });
  } catch (error) {
    return mapAdminContentErrorToResponse(error);
  }
}
