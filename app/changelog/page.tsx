import type { Metadata } from "next";

import { ReleaseCard } from "@/components/docs/release-card";
import { getAllReleaseMeta } from "@/lib/changelog";

const CHANGELOG_DESCRIPTION = "Release notes for every Aniki SDK documentation version.";

export const metadata: Metadata = {
  title: "Changelog",
  description: CHANGELOG_DESCRIPTION,
  alternates: { canonical: "/changelog" },
  openGraph: {
    title: "Changelog",
    description: CHANGELOG_DESCRIPTION,
    type: "website",
  },
};

/**
 * Every release, newest-first, as a `ReleaseCard`. `getAllReleaseMeta`
 * already returns them in that order (D11: newest-first by date, ties
 * broken by descending semver), so this page does no sorting of its own.
 * A flat list, deliberately - version-scoped or filtered changelog views
 * are out of scope (D15).
 */
export default async function ChangelogPage() {
  const releases = await getAllReleaseMeta();

  return (
    <div className="mx-auto w-full max-w-3xl flex-1 px-4 py-12 sm:px-6 lg:px-8">
      <h1 className="mb-3 font-heading text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
        Changelog
      </h1>
      <p className="mb-10 max-w-2xl text-lg text-muted-foreground">{CHANGELOG_DESCRIPTION}</p>

      {releases.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-6 text-center text-muted-foreground">
          No releases have been published yet.
        </p>
      ) : (
        <div className="flex flex-col gap-6">
          {releases.map((release) => (
            <ReleaseCard key={release.slug} release={release} />
          ))}
        </div>
      )}
    </div>
  );
}
