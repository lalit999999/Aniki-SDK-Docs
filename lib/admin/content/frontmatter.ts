/**
 * Deterministic frontmatter serialization: turning a validated
 * `DocFrontmatter` back into the exact YAML block a human author would
 * write, and parsing a `.md` file's source back into `{ frontmatter, body }`.
 *
 * Two invariants matter more than anywhere else in this branch:
 *
 * - **D7, canonical key order.** Editing one field must produce a
 *   one-line git diff, not a reshuffled block - so every write emits
 *   fields in exactly the same order, every time, and omits anything
 *   undefined or equal to its schema default.
 * - **T5, dates are always quoted.** gray-matter's YAML parser (js-yaml)
 *   silently turns an unquoted `updated: 2026-08-03` into a JS `Date`
 *   rather than a string. `docFrontmatterSchema` pre-processes for that on
 *   the *read* side; this module is the *write* side of the same
 *   guarantee - it must never emit a date scalar unquoted, or the next
 *   read/write cycle re-introduces the exact bug the schema works around.
 */

import matter from "gray-matter";

import { parseFrontmatter } from "@/lib/content";
import type { DocFrontmatter } from "@/lib/content";

/** YAML plain scalars that parse as something other than the literal
 * string they spell - booleans, null, and their common aliases. Any
 * string value equal to one of these (case-insensitively) must be quoted
 * to round-trip as a string. */
const RESERVED_SCALARS = new Set(["true", "false", "yes", "no", "on", "off", "null", "~", "y", "n"]);

/** Matches a bare integer or decimal, with an optional sign and exponent -
 * anything that would parse back as a YAML number instead of a string. */
const NUMERIC_SCALAR_PATTERN = /^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/;

/** YAML indicator characters that change a plain scalar's meaning when
 * they lead it (block/flow markers, tags, anchors, comments). */
const LEADING_INDICATOR_PATTERN = /^[!&*?|>%@`"'[\]{},#-]/;

/**
 * Whether a plain (unquoted) YAML scalar would round-trip `value` back as
 * the exact same string. Deliberately conservative - quoting a value that
 * didn't strictly need it is always safe, so every ambiguous case quotes.
 */
function needsQuoting(value: string): boolean {
  if (value.length === 0) {
    return true;
  }
  if (/^\s|\s$/.test(value)) {
    return true;
  }
  if (value.includes(":") || value.includes("#") || value.includes('"') || value.includes("'")) {
    return true;
  }
  if (RESERVED_SCALARS.has(value.toLowerCase())) {
    return true;
  }
  if (NUMERIC_SCALAR_PATTERN.test(value)) {
    return true;
  }
  if (LEADING_INDICATOR_PATTERN.test(value)) {
    return true;
  }
  return false;
}

/** Wraps `value` in a double-quoted YAML scalar, escaping embedded
 * backslashes and double quotes. */
function quoteYamlScalar(value: string): string {
  const escaped = value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  return `"${escaped}"`;
}

/** Serializes a string field as a plain scalar when safe, or a quoted one
 * when {@link needsQuoting} says otherwise. */
function serializeScalar(value: string): string {
  return needsQuoting(value) ? quoteYamlScalar(value) : value;
}

/** Serializes a date-like field (`updated`, `deprecatedSince`) - always
 * quoted (T5), regardless of what {@link needsQuoting} would otherwise
 * decide, since an unquoted `YYYY-MM-DD` is exactly the value gray-matter
 * misparses as a `Date`. */
function serializeDateScalar(value: string): string {
  return quoteYamlScalar(value);
}

/**
 * Serializes a validated `DocFrontmatter` into a YAML block (no `---`
 * fences - see {@link serializeDocument} for the full file), in the
 * canonical D7 field order, omitting any field that is `undefined` or
 * equal to its schema default (`draft: false`, `tags: []`,
 * `deprecated: false`).
 *
 * @example
 * ```ts
 * serializeFrontmatter({
 *   title: "Tools", description: "Built-in tools.", category: "Reference", order: 3,
 * });
 * // 'title: Tools\ndescription: Built-in tools.\ncategory: Reference\norder: 3\n'
 * ```
 */
export function serializeFrontmatter(frontmatter: DocFrontmatter): string {
  const lines: string[] = [];

  lines.push(`title: ${serializeScalar(frontmatter.title)}`);
  lines.push(`description: ${serializeScalar(frontmatter.description)}`);
  lines.push(`category: ${serializeScalar(frontmatter.category)}`);
  lines.push(`order: ${frontmatter.order}`);

  if (frontmatter.updated !== undefined) {
    lines.push(`updated: ${serializeDateScalar(frontmatter.updated)}`);
  }
  if (frontmatter.slug !== undefined) {
    lines.push(`slug: ${serializeScalar(frontmatter.slug)}`);
  }
  if (frontmatter.draft === true) {
    lines.push("draft: true");
  }
  if (frontmatter.tags !== undefined && frontmatter.tags.length > 0) {
    lines.push(`tags: [${frontmatter.tags.map((tag) => quoteYamlScalar(tag)).join(", ")}]`);
  }
  if (frontmatter.deprecated === true) {
    lines.push("deprecated: true");
  }
  if (frontmatter.deprecatedSince !== undefined) {
    lines.push(`deprecatedSince: ${serializeDateScalar(frontmatter.deprecatedSince)}`);
  }
  if (frontmatter.deprecatedReason !== undefined) {
    lines.push(`deprecatedReason: ${serializeScalar(frontmatter.deprecatedReason)}`);
  }
  if (frontmatter.replacedBy !== undefined) {
    lines.push(`replacedBy: ${serializeScalar(frontmatter.replacedBy)}`);
  }
  if (frontmatter.since !== undefined) {
    lines.push(`since: ${serializeScalar(frontmatter.since)}`);
  }

  return `${lines.join("\n")}\n`;
}

/**
 * Serializes a full document: the `---`-fenced frontmatter block, a blank
 * line, then the markdown body. Normalizes the body's line endings to
 * `\n` and trims trailing whitespace, ending the file with exactly one
 * trailing newline (D4: a half-normalized file is exactly the kind of
 * inconsistency an atomic writer should never introduce).
 *
 * @example
 * ```ts
 * serializeDocument({ title: "Tools", description: "...", category: "Reference", order: 3 }, "# Tools\n\nBody.");
 * // '---\ntitle: Tools\n...\n---\n\n# Tools\n\nBody.\n'
 * ```
 */
export function serializeDocument(frontmatter: DocFrontmatter, body: string): string {
  const yaml = serializeFrontmatter(frontmatter);
  const normalizedBody = body.replace(/\r\n/g, "\n").replace(/\s+$/, "");
  return `---\n${yaml}---\n\n${normalizedBody}\n`;
}

/** A `.md` file's source, split into validated frontmatter and body. */
export interface ParsedDocumentFile {
  readonly frontmatter: DocFrontmatter;
  readonly body: string;
}

/**
 * Parses a document's full markdown source (frontmatter block plus body)
 * back into `{ frontmatter, body }`, validating the frontmatter with the
 * *strict* schema (T7) - every required field must be present, unlike the
 * lenient parse the read-side loader uses for legacy frontmatter-less
 * files. The admin panel should never itself produce a file the strict
 * schema rejects, so this is the write side's own guarantee, checked on
 * every read-modify-write cycle.
 *
 * @throws {FrontmatterValidationError} if the frontmatter block is missing
 * a required field or fails any other schema rule.
 *
 * @example
 * ```ts
 * const { frontmatter, body } = parseDocumentFile(source, "content/docs/v1/tools.md");
 * ```
 */
export function parseDocumentFile(source: string, filePath: string): ParsedDocumentFile {
  const parsed = matter(source);
  const frontmatter = parseFrontmatter(parsed.data, filePath);
  return { frontmatter, body: parsed.content.replace(/^\n+/, "") };
}
