import { notFound } from "next/navigation";

import { MarkdownEditor } from "@/components/admin/editor/markdown-editor";
import { PreviewPane } from "@/components/admin/editor/preview-pane";
import { Toaster } from "@/components/ui/sonner";
import { DOC_CATEGORIES, slugToRoute } from "@/lib/content";
import { DOC_COMPONENTS } from "@/lib/doc-components/registry";
import type { DirectiveKind } from "@/lib/doc-components/types";
import {
  ContentAdminUnauthorizedError,
  InvalidDocumentInputError,
  UnsupportedVersionError,
  listStoredDocuments,
  readStoredDocument,
  requireContentAdmin,
} from "@/lib/admin/content";

export const dynamic = "force-dynamic";

/**
 * Every directive name a toolbar button should insert (T-doc in the
 * sub-task 8 spec): every entry in `DOC_COMPONENTS`, minus any name that
 * only ever appears as another directive's child (`tab`, `step`,
 * `accordion-item`, `card`, `feature`) - those are never valid on their
 * own, and inserting one at the top level would just produce an unknown-
 * directive error in the preview. That exclusion set is derived from the
 * registry's own `allowedChildren` declarations, not a hardcoded list, so
 * a future directive with children needs no change here to be excluded
 * correctly.
 */
function getInsertableDirectives(): { name: string; kind: DirectiveKind }[] {
  const childOnly = new Set<string>();
  for (const entry of Object.values(DOC_COMPONENTS)) {
    for (const child of entry.allowedChildren ?? []) {
      childOnly.add(child);
    }
  }
  return Object.entries(DOC_COMPONENTS)
    .filter(([name]) => !childOnly.has(name))
    .map(([name, entry]) => ({ name, kind: entry.kind }));
}

export default async function AdminContentEditorPage({
  params,
  searchParams,
}: {
  params: Promise<{ version: string; slug: string }>;
  searchParams: Promise<{ preview?: string }>;
}) {
  try {
    await requireContentAdmin();
  } catch (error) {
    if (error instanceof ContentAdminUnauthorizedError) {
      notFound();
    }
    throw error;
  }

  const { version, slug } = await params;

  let doc: Awaited<ReturnType<typeof readStoredDocument>>;
  try {
    doc = await readStoredDocument(version, slug);
  } catch (error) {
    if (error instanceof UnsupportedVersionError || error instanceof InvalidDocumentInputError) {
      notFound();
    }
    throw error;
  }
  if (doc === null) {
    notFound();
  }

  const [{ preview }, siblingDocuments] = await Promise.all([searchParams, listStoredDocuments(version)]);
  const siblingSlugs = siblingDocuments.map((sibling) => sibling.slug).filter((sibling) => sibling !== slug);
  const previewBody = preview !== undefined ? decodeURIComponent(preview) : doc.body;
  const route = slugToRoute(slug, version);
  const directives = getInsertableDirectives();

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col gap-3 p-4">
      <div className="flex flex-col gap-0.5">
        <h1 className="font-heading text-xl font-semibold">{doc.frontmatter.title}</h1>
        <p className="font-mono text-xs text-muted-foreground">
          {version} / {slug}
        </p>
      </div>
      <div className="min-h-0 flex-1 overflow-hidden rounded-2xl border border-border">
        <MarkdownEditor
          version={version}
          slug={slug}
          initialFrontmatter={doc.frontmatter}
          initialBody={doc.body}
          siblingSlugs={siblingSlugs}
          directives={directives}
          categories={DOC_CATEGORIES}
        >
          <PreviewPane body={previewBody} filePath={doc.filePath} route={route} />
        </MarkdownEditor>
      </div>
      <Toaster />
    </div>
  );
}
