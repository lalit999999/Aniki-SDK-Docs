/**
 * Validation and accessors for the version registry declared in
 * `config/versions.ts`.
 *
 * `validateVersions` runs once at module scope against the real
 * `DOCS_VERSIONS`, so a malformed registry fails at import time - in
 * development that's the first request, in `next build` (and in
 * `next.config.ts`, which imports this module per T5) that's the build
 * itself. Either way, a broken registry never reaches a deploy.
 */

import { DOCS_VERSIONS } from "@/config/versions";

import { UnknownVersionError, VersionConfigError } from "./errors";
import type { DocsVersion } from "./types";

/** Version ids must be `v` followed by one or more dot-separated integers:
 * `v1`, `v1.1`, `v2`, `v10.2.3`. */
export const VERSION_ID_PATTERN = /^v\d+(?:\.\d+)*$/;

/**
 * Validates a list of `DocsVersion` entries against every registry
 * invariant (D2), aggregating every violation into a single error rather
 * than failing on the first:
 *
 * - every `id` matches {@link VERSION_ID_PATTERN}
 * - every `id` is unique
 * - exactly one entry has `status: "latest"`
 * - entries are ordered newest-first by `releasedAt`
 *
 * @throws {VersionConfigError} listing every violation found.
 *
 * @example
 * ```ts
 * validateVersions([
 *   { id: "v1", label: "v1.0", status: "latest", releasedAt: "2026-08-03" },
 * ]); // does not throw
 * ```
 */
export function validateVersions(versions: readonly DocsVersion[]): void {
  const violations: string[] = [];

  for (const version of versions) {
    if (!VERSION_ID_PATTERN.test(version.id)) {
      violations.push(`"${version.id}" is not a valid version id (expected e.g. "v1", "v1.1")`);
    }
  }

  const idCounts = new Map<string, number>();
  for (const version of versions) {
    idCounts.set(version.id, (idCounts.get(version.id) ?? 0) + 1);
  }
  for (const [id, count] of idCounts) {
    if (count > 1) {
      violations.push(`duplicate version id "${id}" (appears ${count} times)`);
    }
  }

  const latestCount = versions.filter((version) => version.status === "latest").length;
  if (latestCount === 0) {
    violations.push('no version has status "latest"');
  } else if (latestCount > 1) {
    violations.push(
      `${latestCount} versions have status "latest" (${versions
        .filter((version) => version.status === "latest")
        .map((version) => version.id)
        .join(", ")}); exactly one is required`,
    );
  }

  for (let index = 1; index < versions.length; index++) {
    const previous = versions[index - 1];
    const current = versions[index];
    if (previous === undefined || current === undefined) {
      continue;
    }
    if (previous.releasedAt < current.releasedAt) {
      violations.push(
        `versions are not ordered newest-first: "${previous.id}" (${previous.releasedAt}) precedes "${current.id}" (${current.releasedAt})`,
      );
    }
  }

  if (violations.length > 0) {
    throw new VersionConfigError(`invalid documentation version registry:\n${violations.join("\n")}`, {
      violations,
    });
  }
}

validateVersions(DOCS_VERSIONS);

/**
 * Every declared documentation version, newest-first.
 *
 * @example
 * ```ts
 * getVersions().map((v) => v.id); // ["v1"]
 * ```
 */
export function getVersions(): readonly DocsVersion[] {
  return DOCS_VERSIONS;
}

/**
 * The single version with `status: "latest"`. Registry validation
 * guarantees exactly one exists, so this never returns `undefined`.
 *
 * @example
 * ```ts
 * getLatestVersion().id; // "v1"
 * ```
 */
export function getLatestVersion(): DocsVersion {
  const latest = DOCS_VERSIONS.find((version) => version.status === "latest");
  if (latest === undefined) {
    throw new VersionConfigError('no version has status "latest"', {
      violations: ['no version has status "latest"'],
    });
  }
  return latest;
}

/**
 * Looks up a version by id.
 *
 * @throws {UnknownVersionError} if no version has this id.
 *
 * @example
 * ```ts
 * getVersionById("v1"); // { id: "v1", label: "v1.0", ... }
 * getVersionById("v9"); // throws UnknownVersionError
 * ```
 */
export function getVersionById(id: string): DocsVersion {
  const found = findVersionById(id);
  if (found === null) {
    throw new UnknownVersionError(`unknown documentation version "${id}"`, {
      versionId: id,
      knownVersionIds: DOCS_VERSIONS.map((version) => version.id),
    });
  }
  return found;
}

/**
 * Non-throwing variant of {@link getVersionById}.
 *
 * @example
 * ```ts
 * findVersionById("v9"); // null
 * ```
 */
export function findVersionById(id: string): DocsVersion | null {
  return DOCS_VERSIONS.find((version) => version.id === id) ?? null;
}

/**
 * Whether `id` matches a declared version.
 *
 * @example
 * ```ts
 * isKnownVersionId("v1"); // true
 * isKnownVersionId("introduction"); // false
 * ```
 */
export function isKnownVersionId(id: string): boolean {
  return findVersionById(id) !== null;
}

/**
 * Whether `id` is the current latest version's id.
 *
 * @example
 * ```ts
 * isLatestVersionId("v1"); // true, while v1 is latest
 * ```
 */
export function isLatestVersionId(id: string): boolean {
  return getLatestVersion().id === id;
}

/**
 * Resolves an optional version id to a concrete one: `undefined` means "the
 * latest version" (D8's convention for every loader function's trailing
 * `versionId` parameter).
 *
 * @throws {UnknownVersionError} if `id` is given but unknown.
 *
 * @example
 * ```ts
 * resolveVersionId(); // "v1" (the latest)
 * resolveVersionId("v1"); // "v1"
 * ```
 */
export function resolveVersionId(id?: string): string {
  if (id === undefined) {
    return getLatestVersion().id;
  }
  return getVersionById(id).id;
}
