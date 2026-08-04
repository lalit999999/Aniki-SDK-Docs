/**
 * Public entry point for shared navigation logic - breadcrumbs, adjacent-doc
 * lookup, keyboard shortcuts, and the command palette.
 *
 * Every module re-exported here is client-safe by construction: none of them
 * import `server-only` or `@/lib/content`, and all take their document types
 * from `@/lib/content/types` instead. That is what lets client components
 * (the sidebar, the TOC, the shortcut layer) depend on this logic directly,
 * while it stays unit-testable under vitest's node-only environment as plain
 * `.ts` modules.
 */

export { buildBreadcrumbJsonLd, buildBreadcrumbTrail, categoryAnchorId } from "./breadcrumbs";
export type { BreadcrumbTrailItem } from "./breadcrumbs";
