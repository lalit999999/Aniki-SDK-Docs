/**
 * Zod schemas for validating a document's frontmatter block, plus the two
 * entry points (`parseFrontmatter`, `parsePartialFrontmatter`) the loader
 * uses to turn gray-matter's untyped `data` object into a `DocFrontmatter`.
 */

import { z } from "zod";

import { FrontmatterValidationError } from "./errors";
import { DOC_CATEGORIES, type DocCategory, type DocFrontmatter } from "./types";

const categoryEnum = z.enum(DOC_CATEGORIES as [DocCategory, ...DocCategory[]]);

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Builds a Zod schema for an optional `YYYY-MM-DD` date field, guarding
 * against js-yaml's (gray-matter's YAML parser) quirk of treating an
 * unquoted `YYYY-MM-DD` scalar as a native `Date` rather than a string -
 * `updated: 2026-08-03` in a frontmatter block yields a JS `Date` at parse
 * time (T9). The `z.preprocess` step here normalizes that back to a plain
 * date string before the pattern/calendar checks run, so authors don't
 * have to remember to quote the value. Every date field in this schema
 * (`updated`, `deprecatedSince`, and any added later) must be built with
 * this helper rather than a bare `z.string().regex(...)`, or it will
 * silently reject every unquoted date an author writes.
 *
 * @example
 * ```ts
 * const updatedField = isoDateField();
 * updatedField.parse("2026-08-03");        // "2026-08-03"
 * updatedField.parse(new Date("2026-08-03")); // "2026-08-03"
 * ```
 */
function isoDateField() {
  return z.preprocess(
    (value) => (value instanceof Date ? value.toISOString().slice(0, 10) : value),
    z
      .string()
      .regex(ISO_DATE_PATTERN, "must match YYYY-MM-DD")
      .refine((value) => !Number.isNaN(Date.parse(value)), "must be a valid calendar date")
      .optional(),
  );
}

const updatedField = isoDateField();
const deprecatedSinceField = isoDateField();

const slugField = z.string().min(1).optional();
const draftField = z.boolean().default(false);
const tagsField = z.array(z.string()).default([]);
const deprecatedField = z.boolean().default(false);
const deprecatedReasonField = z.string().min(1).optional();
const replacedByField = z.string().min(1).optional();
const sinceField = z.string().min(1).optional();

/**
 * Rejects `deprecatedSince`/`deprecatedReason`/`replacedBy` when
 * `deprecated` isn't `true` (D9): those fields only make sense on a page
 * that is actually marked deprecated, and authoring them without the flag
 * is almost certainly a mistake (the flag was forgotten) rather than
 * intentional. Names every offending field in one pass so a single fix
 * cycle catches them all.
 */
function checkDeprecationFields(
  data: { deprecated?: boolean; deprecatedSince?: string; deprecatedReason?: string; replacedBy?: string },
  ctx: z.RefinementCtx,
): void {
  if (data.deprecated) {
    return;
  }
  const offending: [string, unknown][] = [
    ["deprecatedSince", data.deprecatedSince],
    ["deprecatedReason", data.deprecatedReason],
    ["replacedBy", data.replacedBy],
  ];
  for (const [field, value] of offending) {
    if (value !== undefined) {
      ctx.addIssue({
        code: "custom",
        path: [field],
        message: `"${field}" is set but "deprecated" is not true`,
      });
    }
  }
}

/**
 * Schema for a fully-authored frontmatter block: `title`, `description`,
 * `category`, and `order` are all required, matching every page in
 * `content/docs` as of sub-task 3.
 */
export const docFrontmatterSchema: z.ZodType<DocFrontmatter> = z
  .object({
    title: z.string().min(1),
    description: z.string().min(1),
    category: categoryEnum,
    order: z.number().int().nonnegative(),
    updated: updatedField,
    slug: slugField,
    draft: draftField,
    tags: tagsField,
    deprecated: deprecatedField,
    deprecatedSince: deprecatedSinceField,
    deprecatedReason: deprecatedReasonField,
    replacedBy: replacedByField,
    since: sinceField,
  })
  .superRefine(checkDeprecationFields);

/**
 * Lenient variant used when a `.md` file has no frontmatter block at all
 * (D2: the loader must degrade gracefully rather than crash the build).
 * `title`, `description`, and `category` are optional here - the loader
 * fills them from the document's leading H1 and filename when absent.
 * `order` also gets a default (rather than being required) since an
 * entirely frontmatter-less file has no way to supply one; undated,
 * order-less pages simply sort last within "Reference" by convention of
 * the caller. Any field that *is* present is still validated - absence is
 * tolerated, a wrong type or value is not.
 */
export const partialDocFrontmatterSchema: z.ZodType<Partial<DocFrontmatter>> = z
  .object({
    title: z.string().min(1).optional(),
    description: z.string().min(1).optional(),
    category: categoryEnum.optional(),
    order: z.number().int().nonnegative().default(0),
    updated: updatedField,
    slug: slugField,
    draft: draftField,
    tags: tagsField,
    deprecated: deprecatedField,
    deprecatedSince: deprecatedSinceField,
    deprecatedReason: deprecatedReasonField,
    replacedBy: replacedByField,
    since: sinceField,
  })
  .superRefine(checkDeprecationFields);

function formatIssues(error: z.ZodError): string[] {
  return error.issues.map((issue) => {
    const path = issue.path.length > 0 ? issue.path.join(".") : "(root)";
    return `${path}: ${issue.message}`;
  });
}

/**
 * Validates a raw frontmatter object against the full schema.
 *
 * @throws {FrontmatterValidationError} if any field is missing or invalid.
 * The error's `context.issues` and message both list every failing field,
 * not just the first.
 *
 * @example
 * ```ts
 * const frontmatter = parseFrontmatter(
 *   { title: "Guides", description: "...", category: "Reference", order: 2 },
 *   "content/docs/guides.md",
 * );
 * ```
 */
export function parseFrontmatter(raw: unknown, filePath: string): DocFrontmatter {
  const result = docFrontmatterSchema.safeParse(raw);
  if (!result.success) {
    const issues = formatIssues(result.error);
    throw new FrontmatterValidationError(
      `invalid frontmatter in ${filePath}:\n${issues.join("\n")}`,
      { filePath, issues },
    );
  }
  return result.data;
}

/**
 * Validates a raw frontmatter object against the lenient schema, tolerating
 * a missing `title`, `description`, or `category` (and a missing `order`,
 * which defaults to `0`) but still rejecting present-but-invalid values.
 *
 * @throws {FrontmatterValidationError} if a present field fails validation.
 *
 * @example
 * ```ts
 * // A file with no frontmatter at all: gray-matter yields `{}`.
 * const partial = parsePartialFrontmatter({}, "content/docs/untitled.md");
 * // partial.title, partial.description, partial.category are all undefined
 * // here; the loader supplies content-derived fallbacks for them.
 * ```
 */
export function parsePartialFrontmatter(
  raw: unknown,
  filePath: string,
): Partial<DocFrontmatter> {
  const result = partialDocFrontmatterSchema.safeParse(raw);
  if (!result.success) {
    const issues = formatIssues(result.error);
    throw new FrontmatterValidationError(
      `invalid frontmatter in ${filePath}:\n${issues.join("\n")}`,
      { filePath, issues },
    );
  }
  return result.data;
}
