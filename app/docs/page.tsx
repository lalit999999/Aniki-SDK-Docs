import type { Metadata } from "next";

import { DocsIndex } from "@/components/docs/docs-index";
import { DocsSidebar } from "@/components/docs/docs-sidebar";
import { getAllDocMeta, getDocBySlug, getDocNavigation } from "@/lib/content";
import { getLatestVersion } from "@/lib/versions";

export async function generateMetadata(): Promise<Metadata> {
  const index = await getDocBySlug("index");
  return {
    title: index.meta.title,
    description: index.meta.description,
    alternates: { canonical: "/docs" },
  };
}

/**
 * Documentation home: the latest version's overview plus every page
 * grouped by category. Renders its own sidebar as the first fragment
 * child (D12) - the shared `DocsLayout` no longer knows which version's
 * navigation to load, since a root/shared layout has no route params to
 * derive that from.
 */
export default async function DocsIndexPage() {
  const version = getLatestVersion();
  const [index, meta, nav] = await Promise.all([
    getDocBySlug("index"),
    getAllDocMeta(),
    getDocNavigation(),
  ]);

  return (
    <>
      <DocsSidebar nav={nav} />
      <DocsIndex index={index} docs={meta} version={version} />
    </>
  );
}
