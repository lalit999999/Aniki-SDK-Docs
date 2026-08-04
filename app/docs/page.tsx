import Link from "next/link";
import type { Metadata } from "next";

import { getAllDocMeta, getDocBySlug } from "@/lib/content";

export async function generateMetadata(): Promise<Metadata> {
  const index = await getDocBySlug("index");
  return {
    title: index.meta.title,
    description: index.meta.description,
  };
}

/**
 * Documentation home: an overview plus every page grouped by category,
 * mirroring the hub structure already written in `content/docs/README.md`.
 * Spans both remaining grid columns since it has no table of contents.
 */
export default async function DocsIndexPage() {
  const [index, meta] = await Promise.all([getDocBySlug("index"), getAllDocMeta()]);
  const allDocs = meta.filter((doc) => doc.slug !== "index");

  const categories = Array.from(new Set(allDocs.map((doc) => doc.category)));

  return (
    <article className="min-w-0 py-8 xl:col-span-2">
      <h1 className="mb-3 font-heading text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
        {index.meta.title}
      </h1>
      <p className="mb-10 max-w-2xl text-lg text-muted-foreground">{index.meta.description}</p>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {categories.map((category) => (
          <section key={category} className="rounded-lg border border-border p-5">
            <h2 className="mb-3 font-heading text-sm font-semibold tracking-wide text-muted-foreground uppercase">
              {category}
            </h2>
            <ul className="flex flex-col gap-2">
              {allDocs
                .filter((doc) => doc.category === category)
                .map((doc) => (
                  <li key={doc.slug}>
                    <Link href={doc.route} className="text-sm font-medium text-foreground hover:text-primary hover:underline">
                      {doc.title}
                    </Link>
                    <p className="text-sm text-muted-foreground">{doc.description}</p>
                  </li>
                ))}
            </ul>
          </section>
        ))}
      </div>
    </article>
  );
}
