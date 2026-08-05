/**
 * Filesystem access for the content system: resolving `content/docs`,
 * discovering its per-version subdirectories and markdown files, and
 * reading them. Every disk read in `lib/content` funnels through this
 * module.
 */

import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

import { getVersions, resolveVersionId } from "@/lib/versions/registry";

import { ContentDirectoryError } from "./errors";
import { VersionConfigError } from "@/lib/versions/errors";

/**
 * Resolves the absolute path to the root of every version's content -
 * `content/docs`, one subdirectory per declared version id.
 *
 * Reads `ANIKI_CONTENT_DIR` when set so tests can point the loader at a
 * fixture tree (see `tests/content/paths.test.ts`) instead of the real
 * `content/docs`, without needing to fake `process.cwd()`.
 *
 * @example
 * ```ts
 * getContentRoot(); // "/repo/content/docs"
 * ```
 */
export function getContentRoot(): string {
  return process.env.ANIKI_CONTENT_DIR ?? path.join(process.cwd(), "content", "docs");
}

/**
 * Resolves the absolute path to a single version's documentation
 * directory. Omitting `versionId` resolves the latest version, matching
 * every other optional-trailing-`versionId` function in this module (D8).
 *
 * @throws {UnknownVersionError} if `versionId` is given but not declared
 * in `DOCS_VERSIONS`.
 *
 * @example
 * ```ts
 * getContentDirectory();     // "/repo/content/docs/v1" (v1 is latest)
 * getContentDirectory("v1"); // "/repo/content/docs/v1"
 * ```
 */
export function getContentDirectory(versionId?: string): string {
  return path.join(getContentRoot(), resolveVersionId(versionId));
}

/**
 * Lists the directory names directly under the content root, ignoring
 * entries that start with `_` or `.` (reserved for future partials/config)
 * and anything that isn't a directory. Each remaining name is a candidate
 * version id - `assertVersionDirectories()` is what actually validates
 * that against the registry.
 *
 * @throws {ContentDirectoryError} if the content root doesn't exist or
 * can't be read.
 *
 * @example
 * ```ts
 * await listVersionDirectories(); // ["v1"]
 * ```
 */
export async function listVersionDirectories(): Promise<string[]> {
  const root = getContentRoot();

  let entries;
  try {
    entries = await readdir(root, { withFileTypes: true });
  } catch (error: unknown) {
    const cause = error instanceof Error ? error : undefined;
    throw new ContentDirectoryError(`content root not found or unreadable: ${root}`, { directory: root }, cause);
  }

  return entries
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith("_") && !entry.name.startsWith("."))
    .map((entry) => entry.name)
    .sort();
}

/**
 * Validates that the declared version registry and the on-disk directory
 * set under `content/docs` agree exactly (D3): every declared version has
 * a directory, and every directory belongs to a declared version. Silent
 * drift in either direction is exactly the bug versioning is meant to
 * prevent, so both cases fail the build.
 *
 * @throws {VersionConfigError} listing every declared version with no
 * directory and every directory with no matching declared version.
 *
 * @example
 * ```ts
 * await assertVersionDirectories(); // throws if content/docs/v1 is missing
 * ```
 */
export async function assertVersionDirectories(): Promise<void> {
  const declaredIds = getVersions().map((version) => version.id);
  const onDisk = await listVersionDirectories();

  const declaredSet = new Set(declaredIds);
  const onDiskSet = new Set(onDisk);

  const violations: string[] = [];

  for (const id of declaredIds) {
    if (!onDiskSet.has(id)) {
      violations.push(`declared version "${id}" has no directory at ${path.join(getContentRoot(), id)}`);
    }
  }

  for (const name of onDisk) {
    if (!declaredSet.has(name)) {
      violations.push(`directory "${name}" under ${getContentRoot()} has no matching declared version`);
    }
  }

  if (violations.length > 0) {
    throw new VersionConfigError(`documentation versions and content directories disagree:\n${violations.join("\n")}`, {
      violations,
    });
  }
}

/**
 * Lists every markdown file in a version's content directory, ignoring
 * files that start with `_` or `.` (reserved for future partials/config),
 * sorted alphabetically by absolute path. Omitting `versionId` resolves
 * the latest version (D8).
 *
 * @throws {ContentDirectoryError} if the version's directory doesn't exist
 * or can't be read - the error names the resolved path so a misconfigured
 * `process.cwd()` is diagnosable at a glance instead of a bare `ENOENT`.
 *
 * @example
 * ```ts
 * const files = await listDocFiles();
 * // ["/repo/content/docs/v1/README.md", "/repo/content/docs/v1/api-reference.md", ...]
 * ```
 */
export async function listDocFiles(versionId?: string): Promise<string[]> {
  const directory = getContentDirectory(versionId);

  let entries: string[];
  try {
    entries = await readdir(directory);
  } catch (error: unknown) {
    const cause = error instanceof Error ? error : undefined;
    throw new ContentDirectoryError(
      `content directory not found or unreadable: ${directory}`,
      { directory },
      cause,
    );
  }

  return entries
    .filter((entry) => entry.endsWith(".md") && !entry.startsWith("_") && !entry.startsWith("."))
    .map((entry) => path.join(directory, entry))
    .sort();
}

/**
 * Reads a markdown file as UTF-8 text.
 *
 * @throws {ContentDirectoryError} if the file can't be read.
 *
 * @example
 * ```ts
 * const source = await readDocFile("/repo/content/docs/v1/introduction.md");
 * ```
 */
export async function readDocFile(filePath: string): Promise<string> {
  try {
    return await readFile(filePath, "utf-8");
  } catch (error: unknown) {
    const cause = error instanceof Error ? error : undefined;
    throw new ContentDirectoryError(
      `failed to read content file: ${filePath}`,
      { directory: filePath },
      cause,
    );
  }
}
