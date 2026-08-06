/**
 * Filesystem access for the changelog content system: resolving
 * `content/changelog`, discovering its markdown files, and reading them.
 * Mirrors `lib/content/paths.ts` - the changelog has no per-version
 * subdirectories (a release belongs to exactly one docs version via its
 * `docsVersion` frontmatter field, not a directory), so this is the
 * simpler, single-directory shape `lib/content/paths.ts` had before
 * versioning.
 */

import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

import { ChangelogDirectoryError } from "./errors";

/**
 * Resolves the absolute path to the changelog directory.
 *
 * @example
 * ```ts
 * getChangelogDirectory(); // "/repo/content/changelog"
 * ```
 */
export function getChangelogDirectory(): string {
  return process.env.ANIKI_CHANGELOG_DIR ?? path.join(process.cwd(), "content", "changelog");
}

/**
 * Lists every markdown file in the changelog directory, ignoring files
 * that start with `_` or `.`, sorted alphabetically by absolute path.
 *
 * @throws {ChangelogDirectoryError} if the directory doesn't exist or
 * can't be read.
 *
 * @example
 * ```ts
 * const files = await listReleaseFiles();
 * // ["/repo/content/changelog/v1.0.0.md"]
 * ```
 */
export async function listReleaseFiles(): Promise<string[]> {
  const directory = getChangelogDirectory();

  let entries: string[];
  try {
    entries = await readdir(directory);
  } catch (error: unknown) {
    const cause = error instanceof Error ? error : undefined;
    throw new ChangelogDirectoryError(
      `changelog directory not found or unreadable: ${directory}`,
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
 * @throws {ChangelogDirectoryError} if the file can't be read.
 */
export async function readReleaseFile(filePath: string): Promise<string> {
  try {
    return await readFile(filePath, "utf-8");
  } catch (error: unknown) {
    const cause = error instanceof Error ? error : undefined;
    throw new ChangelogDirectoryError(
      `failed to read changelog file: ${filePath}`,
      { directory: filePath },
      cause,
    );
  }
}
