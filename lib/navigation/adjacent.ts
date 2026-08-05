/**
 * Client-side previous/next lookup, mirroring `getAdjacentDocs` in
 * `lib/content/loader.ts` without importing it. The keyboard shortcut layer
 * is mounted once in the root layout (see D11 in the Step 5 spec) and has
 * no access to a page's server-fetched `adjacent` prop, so it needs to
 * derive the same previous/next pair itself from the nav tree it already
 * has and the current pathname.
 */

import type { AdjacentDocs, DocMeta, DocNavCategory } from "@/lib/content/types";

/**
 * Flattens a category-grouped nav tree into a single list, in the same
 * order `getAllDocMeta` produces it: `DOC_CATEGORIES` order, then each
 * category's own document order. `getDocNavigation` already groups and
 * orders documents this way, so flattening it back out reproduces the exact
 * sequence the server-side pager (`getAdjacentDocs`) walks.
 */
export function flattenNav(nav: readonly DocNavCategory[]): DocMeta[] {
  return nav.flatMap((category) => category.docs);
}

/**
 * The documents immediately before and after the one at `pathname`, in
 * flattened nav order. Both sides are `null` when `pathname` doesn't match
 * any document in `nav` (a non-doc route such as `/`), exactly like the
 * start/end-of-set case for a document that does match.
 */
export function findAdjacentByRoute(nav: readonly DocNavCategory[], pathname: string): AdjacentDocs {
  const flat = flattenNav(nav);
  const index = flat.findIndex((doc) => doc.route === pathname);
  if (index === -1) {
    return { previous: null, next: null };
  }

  return {
    previous: flat[index - 1] ?? null,
    next: flat[index + 1] ?? null,
  };
}
