import Link from "next/link";
import { notFound } from "next/navigation";

import { Toaster } from "@/components/ui/sonner";
import { ContentTable } from "@/components/admin/editor/content-table";
import { CreateDocumentDialog } from "@/components/admin/editor/create-document-dialog";
import { DOC_CATEGORIES } from "@/lib/content";
import { getLatestVersion, getVersions } from "@/lib/versions";
import { ContentAdminUnauthorizedError, listDocuments, requireContentAdmin } from "@/lib/admin/content";

export const dynamic = "force-dynamic";

function VersionSwitcher({ currentVersion }: { readonly currentVersion: string }) {
  const versions = getVersions();
  if (versions.length <= 1) {
    return null;
  }
  return (
    <nav aria-label="Documentation version" className="flex flex-wrap items-center gap-1.5">
      {versions.map((version) => {
        const isActive = version.id === currentVersion;
        return (
          <Link
            key={version.id}
            href={`/admin/content?version=${version.id}`}
            aria-current={isActive ? "page" : undefined}
            className={
              isActive
                ? "rounded-full bg-primary px-3 py-1 text-sm text-primary-foreground"
                : "rounded-full px-3 py-1 text-sm text-muted-foreground hover:bg-muted"
            }
          >
            {version.label}
          </Link>
        );
      })}
    </nav>
  );
}

function LoadFailureCard({ message }: { readonly message: string }) {
  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-destructive/30 bg-destructive/5 p-6 text-sm">
      <p className="font-medium text-destructive">Couldn&apos;t load documents</p>
      <p className="text-muted-foreground">{message}</p>
    </div>
  );
}

function resolveRequestedVersion(versionParam: string | undefined): string {
  if (versionParam === undefined) {
    return getLatestVersion().id;
  }
  const known = getVersions().find((version) => version.id === versionParam);
  return known?.id ?? getLatestVersion().id;
}

export default async function AdminContentPage({
  searchParams,
}: {
  searchParams: Promise<{ version?: string }>;
}) {
  try {
    await requireContentAdmin();
  } catch (error) {
    if (error instanceof ContentAdminUnauthorizedError) {
      notFound();
    }
    throw error;
  }

  const { version: versionParam } = await searchParams;
  const version = resolveRequestedVersion(versionParam);

  let documents: Awaited<ReturnType<typeof listDocuments>> = [];
  let loadError: string | null = null;
  try {
    documents = await listDocuments(version);
  } catch (error) {
    loadError = error instanceof Error ? error.message : "unknown error";
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="font-heading text-2xl font-semibold">Content</h1>
          <p className="text-sm text-muted-foreground">
            Manage documentation pages for version &quot;{version}&quot;.
          </p>
          <VersionSwitcher currentVersion={version} />
        </div>
        <CreateDocumentDialog
          version={version}
          categories={DOC_CATEGORIES}
          existingSlugs={documents.map((doc) => doc.slug)}
        />
      </div>

      {loadError !== null ? (
        <LoadFailureCard message={loadError} />
      ) : (
        <ContentTable version={version} documents={documents} />
      )}

      <Toaster />
    </div>
  );
}
