import Link from "next/link";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { buildBreadcrumbJsonLd, buildBreadcrumbTrail } from "@/lib/navigation";
import type { BreadcrumbTrailItem } from "@/lib/navigation";
import { siteConfig } from "@/config/site";
import type { DocMeta } from "@/lib/content";

/**
 * `Docs -> {Category} -> {Page}` breadcrumb trail, rendered generically over
 * `buildBreadcrumbTrail` so the docs index (`doc: null`, a single "Docs"
 * segment) and a document page (the full three-segment trail) share one
 * component instead of two near-identical ones. The category segment
 * deep-links to that group's anchor on `/docs` - there is no
 * `/docs/category/*` route.
 *
 * Also emits the trail as a schema.org `BreadcrumbList` for search engines.
 * Every value going into the JSON-LD comes from Zod-validated frontmatter
 * (`DocMeta`) and is passed through `JSON.stringify` inside
 * `buildBreadcrumbJsonLd`, so there is no unescaped input reaching
 * `dangerouslySetInnerHTML`.
 */
export function DocsBreadcrumbs({ doc }: { doc: DocMeta | null }) {
  const trail = buildBreadcrumbTrail(doc);
  const jsonLd = buildBreadcrumbJsonLd(trail, siteConfig.url);

  return (
    <Breadcrumb>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd }} />
      <BreadcrumbList>
        {trail.map((item, index) => (
          <BreadcrumbSegment key={item.label} item={item} isLast={index === trail.length - 1} />
        ))}
      </BreadcrumbList>
    </Breadcrumb>
  );
}

function BreadcrumbSegment({ item, isLast }: { item: BreadcrumbTrailItem; isLast: boolean }) {
  return (
    <>
      <BreadcrumbItem>
        {item.href !== null ? (
          <BreadcrumbLink asChild>
            <Link href={item.href}>{item.label}</Link>
          </BreadcrumbLink>
        ) : (
          <BreadcrumbPage>{item.label}</BreadcrumbPage>
        )}
      </BreadcrumbItem>
      {!isLast && <BreadcrumbSeparator />}
    </>
  );
}
