/**
 * Read-only inspection of the version registry: per-version document
 * counts and derived routing facts for the `/admin/versions` table, drift
 * detection between `config/versions.ts` and `content/docs` (T1), and
 * validation of a proposed new version before `scaffoldVersion` (in
 * `scaffold.ts`) attempts to write anything.
 *
 * Everything here is a *consumer* of `lib/content` and `lib/versions` -
 * this module never writes to either.
 */

import "server-only";

import {
  ContentDirectoryError,
  getAllDocMeta,
  listVersionDirectories,
} from "@/lib/content";
import { docsIndexRoute, getVersions, isLatestVersionId, VERSION_ID_PATTERN } from "@/lib/versions";

import type { NewVersionInput, VersionDriftReport, VersionInspectionEntry, VersionsInspectionReport } from "./types";

const RELEASED_AT_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Lists the on-disk version directory names, treating a missing or
 * unreadable content root as "no directories" rather than propagating
 * `ContentDirectoryError` - an inspection tool must render *something*
 * even when `content/docs` itself doesn't exist yet.
 */
async function safeListVersionDirectories(): Promise<readonly string[]> {
  try {
    return await listVersionDirectories();
  } catch (error) {
    if (error instanceof ContentDirectoryError) {
      return [];
    }
    throw error;
  }
}

/**
 * Compares the declared version registry against the on-disk directory set
 * under `content/docs` and reports every mismatch in both directions
 * (T1), without throwing - unlike `assertVersionDirectories()` in
 * `lib/content/paths.ts`, which is deliberately fatal so a broken registry
 * never reaches a deploy. The `/admin/versions` panel needs to *show*
 * drift to a human so they can fix it, not die of it the moment the page
 * renders.
 *
 * @example
 * ```ts
 * const drift = await detectDrift();
 * drift.declaredWithoutDirectory; // ["v3"] if v3 is declared but has no directory
 * ```
 */
export async function detectDrift(): Promise<VersionDriftReport> {
  const declaredIds = getVersions().map((version) => version.id);
  const onDisk = await safeListVersionDirectories();

  const declaredSet = new Set(declaredIds);
  const onDiskSet = new Set(onDisk);

  return {
    declaredWithoutDirectory: declaredIds.filter((id) => !onDiskSet.has(id)),
    directoryWithoutDeclaration: onDisk.filter((name) => !declaredSet.has(name)),
  };
}

/** Whether a `VersionDriftReport` names any offending path at all. */
export function hasDrift(report: VersionDriftReport): boolean {
  return report.declaredWithoutDirectory.length > 0 || report.directoryWithoutDeclaration.length > 0;
}

/**
 * Summarizes every declared documentation version for the `/admin/versions`
 * table: live document/draft/deprecated counts, whether its content
 * directory actually exists, whether its `migrationGuideSlug` resolves,
 * and its derived redirect behaviour (T4). Never throws on drift - a
 * version with no directory is reported with zeroed counts and
 * `directoryExists: false` rather than aborting the whole report.
 *
 * @example
 * ```ts
 * const { versions, drift } = await inspectVersions();
 * versions[0].docCount; // 16
 * ```
 */
export async function inspectVersions(): Promise<VersionsInspectionReport> {
  const versions = getVersions();
  const onDisk = new Set(await safeListVersionDirectories());
  const drift = await detectDrift();

  const entries = await Promise.all(
    versions.map(async (version): Promise<VersionInspectionEntry> => {
      const directoryExists = onDisk.has(version.id);

      let docCount = 0;
      let draftCount = 0;
      let deprecatedCount = 0;
      let migrationGuideResolves: boolean | null = null;

      if (directoryExists) {
        try {
          const docs = await getAllDocMeta(version.id);
          docCount = docs.length;
          draftCount = docs.filter((doc) => doc.draft).length;
          deprecatedCount = docs.filter((doc) => doc.deprecated).length;
          if (version.migrationGuideSlug !== undefined) {
            migrationGuideResolves = docs.some((doc) => doc.slug === version.migrationGuideSlug);
          }
        } catch {
          // A version whose directory exists but can't be read (bad
          // frontmatter, a duplicate slug, ...) still gets a row - its
          // counts stay at zero rather than taking down the whole report.
        }
      }

      return {
        ...version,
        docCount,
        draftCount,
        deprecatedCount,
        directoryExists,
        indexRoute: docsIndexRoute(version.id),
        migrationGuideResolves,
        prefixedUrlRedirects: isLatestVersionId(version.id),
      };
    }),
  );

  return { versions: entries, drift };
}

/**
 * Validates a proposed new version against every registry and content
 * invariant `scaffoldVersion` (in `scaffold.ts`) will otherwise fail on
 * partway through a write: id pattern and uniqueness, label presence,
 * `releasedAt` format and newest-first ordering (T3), source version
 * existence, and - when supplied - whether `migrationGuideSlug` resolves
 * to a real page in the source version's content (T5), since that is what
 * the new version's copied directory will contain.
 *
 * Aggregates every issue found rather than stopping at the first, so a
 * single fix cycle in the scaffold dialog can address them all.
 *
 * @example
 * ```ts
 * const issues = await validateNewVersionInput({
 *   id: "v2",
 *   label: "v2.0",
 *   releasedAt: "2026-09-01",
 *   sourceVersionId: "v1",
 *   promoteToLatest: true,
 * });
 * issues; // [] if valid
 * ```
 */
export async function validateNewVersionInput(input: NewVersionInput): Promise<readonly string[]> {
  const issues: string[] = [];
  const versions = getVersions();

  if (!VERSION_ID_PATTERN.test(input.id)) {
    issues.push(`"${input.id}" is not a valid version id (expected e.g. "v2", "v1.1")`);
  } else if (versions.some((version) => version.id === input.id)) {
    issues.push(`version id "${input.id}" already exists`);
  }

  if (input.label.trim().length === 0) {
    issues.push("label must not be empty");
  }

  if (!RELEASED_AT_PATTERN.test(input.releasedAt)) {
    issues.push(`releasedAt "${input.releasedAt}" is not in YYYY-MM-DD format`);
  } else {
    const newest = versions[0];
    if (newest !== undefined && input.releasedAt <= newest.releasedAt) {
      issues.push(
        `releasedAt "${input.releasedAt}" must be newer than the current newest version "${newest.id}" (${newest.releasedAt})`,
      );
    }
  }

  const source = versions.find((version) => version.id === input.sourceVersionId);
  if (source === undefined) {
    issues.push(`unknown source version "${input.sourceVersionId}"`);
  }

  if (input.migrationGuideSlug !== undefined && source !== undefined) {
    try {
      const sourceDocs = await getAllDocMeta(input.sourceVersionId);
      if (!sourceDocs.some((doc) => doc.slug === input.migrationGuideSlug)) {
        issues.push(
          `migrationGuideSlug "${input.migrationGuideSlug}" has no matching page in source version "${input.sourceVersionId}"`,
        );
      }
    } catch {
      issues.push(`could not read source version "${input.sourceVersionId}" content to validate migrationGuideSlug`);
    }
  }

  return issues;
}
