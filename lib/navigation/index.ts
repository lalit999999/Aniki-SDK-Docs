/**
 * Public entry point for shared navigation logic - breadcrumbs, adjacent-doc
 * lookup, and keyboard shortcuts. The command palette moved to
 * `@/lib/search` and `@/components/search` - full-text section search
 * superseded the page-only navigation palette this module used to also
 * export (`buildPaletteItems`), so there is no palette-building logic left
 * here.
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

export { flattenNav, findAdjacentByRoute } from "./adjacent";

export { isTypingTarget, matchShortcut, SHORTCUTS } from "./shortcuts";
export type { ShortcutAction, ShortcutDefinition, ShortcutEvent, ShortcutTarget } from "./shortcuts";
