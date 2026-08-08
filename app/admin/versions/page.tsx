import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { DriftBanner } from "@/components/admin/versions/drift-banner";
import { ScaffoldDialog } from "@/components/admin/versions/scaffold-dialog";
import { VersionTable } from "@/components/admin/versions/version-table";
import { hasDrift, inspectVersions, requireVersionsAdmin, VersionsAdminUnauthorizedError } from "@/lib/admin/versions";
import { getVersions } from "@/lib/versions";

/** Reads cookies and the live content index on every request. */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Documentation versions",
  robots: { index: false, follow: false },
};

/**
 * Version registry admin panel: a drift banner (rendered first,
 * unmissable, per T1), the declared-version table, and the scaffold
 * dialog for adding a new version. `requireVersionsAdmin()` fails closed -
 * any failure renders `notFound()` rather than a partial page, since a
 * 404 doesn't confirm to an unauthenticated visitor that this route even
 * exists.
 */
export default async function VersionsAdminPage() {
  try {
    await requireVersionsAdmin();
  } catch (error) {
    if (error instanceof VersionsAdminUnauthorizedError) {
      notFound();
    }
    throw error;
  }

  const report = await inspectVersions();
  const sourceVersions = getVersions().map((version) => ({
    id: version.id,
    label: version.label,
    releasedAt: version.releasedAt,
    status: version.status,
  }));

  return (
    <div className="mx-auto w-full max-w-5xl flex-1 px-4 py-12 sm:px-6 lg:px-8">
      <DriftBanner drift={report.drift} />

      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-heading text-3xl font-bold tracking-tight text-foreground">Documentation versions</h1>
          <p className="mt-2 text-muted-foreground">
            Every declared documentation version, its live document counts, and its routing behaviour.
          </p>
        </div>
        <ScaffoldDialog sourceVersions={sourceVersions} disabled={hasDrift(report.drift)} />
      </div>

      <VersionTable versions={report.versions} />
    </div>
  );
}
