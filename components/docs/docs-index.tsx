import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { DocsBreadcrumbs } from "@/components/docs/docs-breadcrumbs";
import { categoryAnchorId } from "@/lib/navigation";
import type { Doc, DocMeta } from "@/lib/content";
import type { DocsVersion } from "@/lib/versions";

/**
 * A documentation version's home: the version's own overview page plus
 * every one of its pages grouped by category. Shared by `app/docs/page.tsx`
 * (the latest version) and the version-index branch of the `[...slug]`
 * catch-all (any other version), so the markup exists exactly once instead
 * of drifting between "the latest version's index" and "every other
 * version's index" over time.
 */
export function DocsIndex({
  index,
  docs,
  version,
}: {
  index: Doc;
  docs: DocMeta[];
  version: DocsVersion;
}) {
  const allDocs = docs.filter((doc) => doc.slug !== "index");
  const categories = Array.from(new Set(allDocs.map((doc) => doc.category)));

  return (
    <article className="min-w-0 py-8 xl:col-span-2">
      <DocsBreadcrumbs doc={null} />
      <div className="mt-3 mb-3 flex flex-wrap items-center gap-3">
        <h1 className="font-heading text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          {index.meta.title}
        </h1>
        <Badge variant={version.status === "latest" ? "secondary" : "outline"}>{version.label}</Badge>
      </div>
      <p className="mb-10 max-w-2xl text-lg text-muted-foreground">{index.meta.description}</p>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {categories.map((category) => (
          <section key={category} id={categoryAnchorId(category)} className="scroll-mt-24 rounded-lg border border-border p-5">
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
