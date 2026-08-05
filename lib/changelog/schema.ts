/**
 * Zod schema for validating a release's frontmatter block, plus the entry
 * point (`parseReleaseFrontmatter`) the loader uses to turn gray-matter's
 * untyped `data` object into a `ReleaseFrontmatter`.
 */

import { z } from "zod";

import { ReleaseFrontmatterInvalidError } from "./errors";
import type { ReleaseFrontmatter, ReleaseStatus } from "./types";

const RELEASE_STATUSES: readonly ReleaseStatus[] = ["stable", "prerelease", "yanked"];
const statusEnum = z.enum(RELEASE_STATUSES as [ReleaseStatus, ...ReleaseStatus[]]);

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const SEMVER_PATTERN = /^\d+\.\d+\.\d+$/;

/**
 * Guards against js-yaml's unquoted-date coercion the same way
 * `isoDateField` does in `lib/content/schema.ts` (T9) - kept as its own
 * copy rather than a shared import so `lib/changelog` has no dependency on
 * `lib/content` beyond the pure, filesystem-free types it already reuses.
 */
const dateField = z.preprocess(
  (value) => (value instanceof Date ? value.toISOString().slice(0, 10) : value),
  z
    .string()
    .regex(ISO_DATE_PATTERN, "must match YYYY-MM-DD")
    .refine((value) => !Number.isNaN(Date.parse(value)), "must be a valid calendar date"),
);

/**
 * Guards against js-yaml's numeric coercion of an unquoted two-segment
 * version number (T10) - `version: 1.0` parses as the number `1`. Coercing
 * a bare number back to a string before the semver pattern check at least
 * catches the common case; authors are still expected to quote `version`
 * so `1.0.0`-shaped values (already strings, since YAML doesn't parse
 * three-segment dotted numbers as numeric) are unaffected either way.
 */
const versionField = z.preprocess(
  (value) => (typeof value === "number" ? String(value) : value),
  z.string().regex(SEMVER_PATTERN, "must be a semantic version, e.g. \"1.0.0\""),
);

export const releaseFrontmatterSchema: z.ZodType<ReleaseFrontmatter> = z.object({
  version: versionField,
  title: z.string().min(1),
  date: dateField,
  docsVersion: z.string().min(1),
  status: statusEnum,
  summary: z.string().min(1),
  highlights: z.array(z.string()).default([]),
});

function formatIssues(error: z.ZodError): string[] {
  return error.issues.map((issue) => {
    const path = issue.path.length > 0 ? issue.path.join(".") : "(root)";
    return `${path}: ${issue.message}`;
  });
}

/**
 * Validates a raw frontmatter object against the release schema.
 *
 * @throws {ReleaseFrontmatterInvalidError} if any field is missing or
 * invalid. The error's `context.issues` and message both list every
 * failing field, not just the first.
 *
 * @example
 * ```ts
 * const frontmatter = parseReleaseFrontmatter(
 *   { version: "1.0.0", title: "Initial release", date: "2026-08-03",
 *     docsVersion: "v1", status: "stable", summary: "..." },
 *   "content/changelog/v1.0.0.md",
 * );
 * ```
 */
export function parseReleaseFrontmatter(raw: unknown, filePath: string): ReleaseFrontmatter {
  const result = releaseFrontmatterSchema.safeParse(raw);
  if (!result.success) {
    const issues = formatIssues(result.error);
    throw new ReleaseFrontmatterInvalidError(
      `invalid release frontmatter in ${filePath}:\n${issues.join("\n")}`,
      { filePath, issues },
    );
  }
  return result.data;
}
