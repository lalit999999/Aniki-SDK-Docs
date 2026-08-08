/**
 * Path traversal-safe resolution from a version id + author-supplied slug
 * to an absolute file path under `content/docs/<version>`.
 *
 * Every function here either validates its input against a fixed pattern
 * before ever touching a path, or rebuilds a path from already-validated
 * parts rather than joining raw input directly - never both "trust the
 * input" and "build a path from it" in the same step. This is the module
 * `lib/admin/content/writer.ts` funnels every disk write through, so a
 * malicious or malformed slug is rejected here, long before any `fs` call.
 */

import { access } from "node:fs/promises";
import path from "node:path";

import { getContentDirectory } from "@/lib/content";
import { isKnownVersionId, VERSION_ID_PATTERN } from "@/lib/versions/registry";

import { InvalidDocumentInputError, UnsupportedVersionError } from "./errors";

/** The exact inverse of `fileNameToSlug` in `lib/content/slug.ts` - kept
 * as its own copy rather than imported, since it isn't part of that
 * module's exported surface (only the filename -> slug direction is). */
const FILE_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$|^index$/;

/**
 * Asserts that `versionId` is declared in the version registry (T9). The
 * admin panel must never write into - or imply the existence of - a
 * version directory that isn't declared, since `assertVersionDirectories()`
 * fails the whole site build on drift in either direction.
 *
 * @throws {UnsupportedVersionError} if `versionId` isn't declared.
 *
 * @example
 * ```ts
 * assertKnownVersion("v1"); // does not throw
 * assertKnownVersion("v9"); // throws UnsupportedVersionError
 * ```
 */
export function assertKnownVersion(versionId: string): void {
  if (!isKnownVersionId(versionId)) {
    throw new UnsupportedVersionError(`unknown documentation version "${versionId}"`, { version: versionId });
  }
}

/**
 * Validates an author-supplied slug against every rule the content system
 * itself enforces (T1), aggregating every violation into one error rather
 * than stopping at the first - empty, uppercase letters, whitespace, a
 * leading/trailing/doubled hyphen, a mismatch against the same slug
 * pattern the loader uses, and a collision with the documentation version
 * id pattern (`v1`, `v2.1`, ...), which `resolveDocsPath` always reads as
 * a version segment, never a page slug.
 *
 * @throws {InvalidDocumentInputError} listing every violation found.
 *
 * @example
 * ```ts
 * validateSlugInput("quick-start"); // does not throw
 * validateSlugInput("Quick Start"); // throws, issues: ["must not contain uppercase letters", ...]
 * validateSlugInput("v2");          // throws, issues: ['reserved: matches the version id pattern']
 * ```
 */
export function validateSlugInput(slug: string): void {
  const issues: string[] = [];

  if (slug.length === 0) {
    issues.push("slug must not be empty");
  }
  if (/[A-Z]/.test(slug)) {
    issues.push("slug must not contain uppercase letters");
  }
  if (/\s/.test(slug)) {
    issues.push("slug must not contain whitespace");
  }
  if (slug.startsWith("-")) {
    issues.push("slug must not start with a hyphen");
  }
  if (slug.length > 1 && slug.endsWith("-")) {
    issues.push("slug must not end with a hyphen");
  }
  if (slug.includes("--")) {
    issues.push("slug must not contain consecutive hyphens");
  }
  if (slug.length > 0 && !FILE_SLUG_PATTERN.test(slug)) {
    issues.push('slug must be lowercase, hyphen-separated words (e.g. "quick-start"), or "index"');
  }
  if (VERSION_ID_PATTERN.test(slug)) {
    issues.push(`slug "${slug}" is reserved: it matches the documentation version id pattern (e.g. "v1", "v2.1")`);
  }

  if (issues.length > 0) {
    throw new InvalidDocumentInputError(`invalid slug "${slug}":\n${issues.join("\n")}`, { issues });
  }
}

/**
 * Maps a validated slug to its markdown filename - the exact inverse of
 * `fileNameToSlug` in `lib/content/slug.ts`: `"index"` writes to
 * `README.md`, every other slug writes to `<slug>.md`.
 *
 * Does not itself validate `slug` - callers resolve a path through
 * {@link resolveDocumentPath}, which validates first.
 *
 * @example
 * ```ts
 * slugToFileName("index");       // "README.md"
 * slugToFileName("quick-start"); // "quick-start.md"
 * ```
 */
export function slugToFileName(slug: string): string {
  return slug === "index" ? "README.md" : `${slug}.md`;
}

/**
 * Resolves a version id and slug to an absolute file path under
 * `content/docs/<version>`, validating both first and rebuilding the path
 * from the validated parts (never by joining the raw input) as a second,
 * defense-in-depth line against path traversal: the resolved path is
 * asserted to still sit inside the version's own content directory.
 *
 * @throws {UnsupportedVersionError} if `versionId` isn't declared.
 * @throws {InvalidDocumentInputError} if `slug` fails {@link validateSlugInput},
 * or - in the unreachable-in-practice case that should never actually
 * trigger given that validation - if the rebuilt path still resolves
 * outside the version's content directory.
 *
 * @example
 * ```ts
 * resolveDocumentPath("v1", "tools"); // "/repo/content/docs/v1/tools.md"
 * resolveDocumentPath("v1", "../../etc/passwd"); // throws InvalidDocumentInputError
 * ```
 */
export function resolveDocumentPath(versionId: string, slug: string): string {
  assertKnownVersion(versionId);
  validateSlugInput(slug);

  const directory = path.resolve(getContentDirectory(versionId));
  const fileName = slugToFileName(slug);
  const resolved = path.resolve(directory, fileName);

  if (resolved !== path.join(directory, fileName) || path.dirname(resolved) !== directory) {
    throw new InvalidDocumentInputError(`slug "${slug}" resolves outside its version directory`, {
      issues: [`slug "${slug}" does not resolve inside the content directory for version "${versionId}"`],
    });
  }

  return resolved;
}

/**
 * Whether a document already exists at this version/slug.
 *
 * @throws Same as {@link resolveDocumentPath}.
 *
 * @example
 * ```ts
 * await documentExists("v1", "introduction"); // true
 * await documentExists("v1", "does-not-exist"); // false
 * ```
 */
export async function documentExists(versionId: string, slug: string): Promise<boolean> {
  const filePath = resolveDocumentPath(versionId, slug);
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}
