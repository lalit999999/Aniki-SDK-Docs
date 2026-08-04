/**
 * Pure item-list construction for the ⌘K navigation palette.
 *
 * This indexes documentation *pages* only - title, description, category -
 * plus the site's primary nav links. Heading-level and full-text search
 * require a build-time content index and a server boundary, which belongs
 * to the separate, later search feature (Orama/Pagefind). `buildPaletteItems`
 * is the seam that feature extends: it can add more items (headings,
 * snippets) or a ranking layer on top without this module or `NavPalette`
 * changing shape.
 */

import { DOC_CATEGORIES } from "@/lib/content/types";
import type { DocMeta, DocNavCategory } from "@/lib/content/types";
import type { SiteNavLink } from "@/config/site";

/** One entry in the palette: a documentation page or a primary nav link. */
export interface PaletteItem {
  /** Stable and unique across both documents and primary nav links. */
  id: string;
  label: string;
  description: string;
  /** Section heading the item renders under - a `DocCategory` for a
   * document, or `"Site"` for a primary nav link. */
  group: string;
  route: string;
  /** Whether selecting this item should open a new tab rather than
   * navigate client-side. */
  external: boolean;
}

/**
 * Builds the palette's full item list: every document grouped by category
 * in `DOC_CATEGORIES` order, then a `"Site"` group built from `primaryNav`.
 * An empty `primaryNav` simply produces no items in that group (and no
 * `"Site"`-grouped items appear in the result).
 */
export function buildPaletteItems(
  nav: readonly DocNavCategory[],
  primaryNav: readonly SiteNavLink[],
): PaletteItem[] {
  const docItems = DOC_CATEGORIES.flatMap((category) => {
    const section = nav.find((entry) => entry.category === category);
    return section === undefined ? [] : section.docs.map(docToPaletteItem);
  });

  const siteItems = primaryNav.map(linkToPaletteItem);

  return [...docItems, ...siteItems];
}

function docToPaletteItem(doc: DocMeta): PaletteItem {
  return {
    id: `doc:${doc.slug}`,
    label: doc.title,
    description: doc.description,
    group: doc.category,
    route: doc.route,
    external: false,
  };
}

function linkToPaletteItem(link: SiteNavLink): PaletteItem {
  return {
    id: `site:${link.href}`,
    label: link.label,
    description: link.href,
    group: "Site",
    route: link.href,
    external: link.external ?? false,
  };
}
