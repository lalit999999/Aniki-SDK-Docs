/**
 * Type definitions for the version management admin surface: inspection
 * reports, drift reports, and new-version input. Pure data shapes shared by
 * `inspect.ts`, `scaffold.ts`, the API routes, and the admin page.
 */

import type { DocsVersion } from "@/lib/versions";

/**
 * A single declared version enriched with everything the `/admin/versions`
 * table needs to render: live document counts, whether its content
 * directory actually exists on disk, and its derived routing/redirect
 * behaviour (T4).
 */
export interface VersionInspectionEntry extends DocsVersion {
  /** Number of visible documents in this version, per `getAllDocMeta`
   * (T6: filtered by draft status per `NODE_ENV`, so this is always `0`
   * for draft-only content in a production deployment - see `docCount`'s
   * caveat on `draftCount` below). */
  docCount: number;
  /** Number of documents in this version with `draft: true`. Only
   * observable outside `NODE_ENV=production`: `getAllDocMeta` excludes
   * drafts entirely in production (T6), so this is always `0` there. Not a
   * bug in this module - it inherits the content system's visibility
   * rule rather than reading disk directly to work around it. */
  draftCount: number;
  /** Number of documents in this version with `deprecated: true`. */
  deprecatedCount: number;
  /** Whether `content/docs/<id>` exists on disk. `false` here is exactly
   * the "declared version has no directory" drift case (T1), surfaced
   * per-entry instead of only in the aggregate `VersionDriftReport`. */
  directoryExists: boolean;
  /** This version's own index route (T4): `/docs` while it's latest,
   * `/docs/<id>` otherwise. */
  indexRoute: string;
  /** Whether `migrationGuideSlug` is declared and resolves to a real page
   * in this version. `null` when no `migrationGuideSlug` is declared. */
  migrationGuideResolves: boolean | null;
  /** Whether this version's *prefixed* URLs (`/docs/<id>`, `/docs/<id>/:slug`)
   * permanently redirect to their unprefixed form (T4) - true only for the
   * current latest version, per the redirect table `next.config.ts`
   * derives from `getLatestVersion()` at build time. */
  prefixedUrlRedirects: boolean;
}

/**
 * Declared-registry-vs-disk drift (T1), reported rather than thrown -
 * unlike `assertVersionDirectories()` in `lib/content/paths.ts`, which is
 * deliberately fatal so a broken registry never reaches a deploy. The
 * `/admin/versions` panel needs to *show* drift to a human so they can fix
 * it, not die of it the moment the page renders.
 */
export interface VersionDriftReport {
  /** Declared version ids with no matching directory under `content/docs`. */
  declaredWithoutDirectory: readonly string[];
  /** Directory names under `content/docs` with no matching declared version. */
  directoryWithoutDeclaration: readonly string[];
}

/** The full `/admin/versions` inspection payload. */
export interface VersionsInspectionReport {
  versions: readonly VersionInspectionEntry[];
  drift: VersionDriftReport;
}

/** Input to `validateNewVersionInput` and `scaffoldVersion` (D4/D5): a
 * proposed new documentation version, scaffolded from an existing one. */
export interface NewVersionInput {
  /** Must match `VERSION_ID_PATTERN` and not already be declared. */
  id: string;
  /** Human-readable label shown in the version switcher, e.g. `"v2.0"`. */
  label: string;
  /** ISO date (`YYYY-MM-DD`). Must be newer than every existing version's
   * `releasedAt` (T3: entries stay ordered newest-first). */
  releasedAt: string;
  /** Id of the existing version whose content directory is copied to seed
   * the new one. */
  sourceVersionId: string;
  /** When `true`, the new version is scaffolded with `status: "latest"`
   * and the previous latest is demoted to `"maintenance"` in the same
   * write (T3). When `false`, the new version is scaffolded with
   * `status: "maintenance"`. */
  promoteToLatest: boolean;
  /** Optional slug, within `sourceVersionId`'s content (and therefore the
   * newly copied content), of the migration guide page. Never set
   * automatically (D5) - validated against the source version's existing
   * pages before the write commits. */
  migrationGuideSlug?: string;
}
