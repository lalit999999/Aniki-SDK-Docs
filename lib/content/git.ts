/**
 * Last-modified resolution: frontmatter, then git history, then
 * filesystem mtime, then `null` (D7).
 *
 * The git lookup must never throw and never crash a build - Vercel builds
 * from shallow clones, the runtime image may not even have `git`
 * installed, and a file may be untracked. Every failure mode collapses to
 * the same thing: "no answer, try the next source."
 */

import { execFile } from "node:child_process";
import { stat } from "node:fs/promises";
import { promisify } from "node:util";

import type { UpdatedSource } from "./types";

const execFileAsync = promisify(execFile);

/**
 * Looks up a file's last commit date via `git log`.
 *
 * Uses `execFile` with the path passed as an argument (never
 * string-interpolated into a shell command), so there is no command
 * injection surface regardless of what `filePath` contains.
 *
 * @returns a trimmed ISO 8601 string, or `null` if git is unavailable,
 * exits non-zero, returns empty output, or the file is untracked. Never
 * throws.
 *
 * @example
 * ```ts
 * await getGitLastModified("content/docs/introduction.md");
 * // "2026-08-03T14:22:10+05:30" or null
 * ```
 */
export async function getGitLastModified(filePath: string): Promise<string | null> {
  try {
    const { stdout } = await execFileAsync("git", ["log", "-1", "--format=%cI", "--", filePath]);
    const trimmed = stdout.trim();
    return trimmed.length > 0 ? trimmed : null;
  } catch {
    return null;
  }
}

/**
 * Resolves a document's last-updated timestamp using the full precedence
 * chain: an explicit `frontmatter.updated` date wins outright; otherwise
 * git history; otherwise the file's filesystem `mtime`; otherwise `null`.
 * The returned `source` records which one actually answered.
 *
 * @example
 * ```ts
 * await resolveLastModified("content/docs/guides.md", "2026-01-15");
 * // { updatedAt: "2026-01-15T00:00:00.000Z", source: "frontmatter" }
 *
 * await resolveLastModified("content/docs/guides.md");
 * // { updatedAt: "2026-08-03T14:22:10.000Z", source: "git" }
 * ```
 */
export async function resolveLastModified(
  filePath: string,
  frontmatterUpdated?: string,
): Promise<{ updatedAt: string | null; source: UpdatedSource }> {
  if (frontmatterUpdated !== undefined) {
    return { updatedAt: new Date(frontmatterUpdated).toISOString(), source: "frontmatter" };
  }

  const gitDate = await getGitLastModified(filePath);
  if (gitDate !== null) {
    return { updatedAt: new Date(gitDate).toISOString(), source: "git" };
  }

  try {
    const stats = await stat(filePath);
    return { updatedAt: stats.mtime.toISOString(), source: "filesystem" };
  } catch {
    return { updatedAt: null, source: "unknown" };
  }
}
