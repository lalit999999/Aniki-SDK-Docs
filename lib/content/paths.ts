/**
 * Filesystem access for the content system: resolving `content/docs`,
 * discovering its markdown files, and reading them. Every disk read in
 * `lib/content` funnels through this module.
 */

import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

import { ContentDirectoryError } from "./errors";

/**
 * Resolves the absolute path to the documentation directory.
 *
 * @example
 * ```ts
 * getContentDirectory(); // "/repo/content/docs"
 * ```
 */
export function getContentDirectory(): string {
  return path.join(process.cwd(), "content", "docs");
}

/**
 * Lists every markdown file in the content directory, ignoring files that
 * start with `_` or `.` (reserved for future partials/config), sorted
 * alphabetically by absolute path.
 *
 * @throws {ContentDirectoryError} if the directory doesn't exist or can't
 * be read - the error names the resolved path so a misconfigured
 * `process.cwd()` is diagnosable at a glance instead of a bare `ENOENT`.
 *
 * @example
 * ```ts
 * const files = await listDocFiles();
 * // ["/repo/content/docs/README.md", "/repo/content/docs/api-reference.md", ...]
 * ```
 */
export async function listDocFiles(): Promise<string[]> {
  const directory = getContentDirectory();

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
 * const source = await readDocFile("/repo/content/docs/introduction.md");
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
