import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { DocsBreadcrumbs } from "@/components/docs/docs-breadcrumbs";
import { DocsContent } from "@/components/docs/docs-content";
import { EditOnGithub } from "@/components/docs/edit-on-github";
import { MobileToc } from "@/components/docs/mobile-toc";
import { PreviousNextNav } from "@/components/docs/previous-next-nav";
import { TableOfContents } from "@/components/docs/table-of-contents";
import { findDocBySlug, getAdjacentDocs, getDocSlugs } from "@/lib/content";

/**
 * Every known doc slug is prerendered statically; anything else 404s
 * (`dynamicParams = false` below) rather than attempting a runtime render.
 */
export async function generateStaticParams() {
  const slugs = await getDocSlugs();
  return slugs.filter((slug) => slug !== "index").map((slug) => ({ slug }));
}

export const dynamicParams = false;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const doc = await findDocBySlug(slug);
  if (doc === null) {
    return {};
  }
  return {
    title: doc.meta.title,
    description: doc.meta.description,
    alternates: { canonical: doc.meta.route },
    openGraph: { title: doc.meta.title, description: doc.meta.description },
  };
}

export default async function DocPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const doc = await findDocBySlug(slug);
  if (doc === null) {
    notFound();
  }

  const adjacent = await getAdjacentDocs(slug);

  return (
    <>
      <div className="min-w-0 py-8">
        <DocsBreadcrumbs doc={doc.meta} />
        <MobileToc toc={doc.toc} />
        <DocsContent doc={doc} />
        <div className="mt-4 mb-8">
          <EditOnGithub slug={slug} />
        </div>
        <PreviousNextNav adjacent={adjacent} />
      </div>
      <TableOfContents toc={doc.toc} />
    </>
  );
}
