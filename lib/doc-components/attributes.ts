/**
 * Attribute coercion and label extraction for parsed directive nodes.
 *
 * `remark-directive` attribute values are always `string | null |
 * undefined` (D9) - directive syntax has no concept of a boolean or a
 * number, so `{dev}` (a bare flag) parses to `dev: ""` and there is no way
 * to author a numeric or boolean value directly. Every component schema
 * built on these helpers coerces from string centrally, here, rather than
 * each component re-deriving its own truthy/falsy rules.
 */

import { z } from "zod";
import { toString as mdastToString } from "mdast-util-to-string";
import type { RootContent } from "mdast";
import type { ContainerDirective, LeafDirective, TextDirective } from "mdast-util-directive";

type DirectiveWithAttributes = ContainerDirective | LeafDirective | TextDirective;

/**
 * Reads a directive node's raw attributes, dropping any key whose value is
 * `null` or `undefined` so downstream Zod schemas only ever see `string`
 * values. `null`/`undefined` values are not produced by real directive
 * syntax today, but `mdast-util-directive`'s own type declares them
 * possible, so this normalizes them away at the boundary rather than
 * leaking the possibility into every schema.
 *
 * @example
 * ```ts
 * toAttributeRecord(node); // { type: "warning", title: "Careful" }
 * ```
 */
export function toAttributeRecord(node: DirectiveWithAttributes): Record<string, string> {
  const raw = node.attributes ?? {};
  const record: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (value !== null && value !== undefined) {
      record[key] = value;
    }
  }
  return record;
}

const BOOLEAN_TRUTHY = ["", "true", "yes", "1", "on"];
const BOOLEAN_FALSY = ["false", "no", "0", "off"];

/**
 * A boolean attribute: `""` (a bare `{dev}` flag), `"true"`, `"yes"`,
 * `"1"`, `"on"` -> `true`; `"false"`, `"no"`, `"0"`, `"off"` -> `false`;
 * anything else is a Zod issue. Compose with `.optional()` for an
 * attribute that may be absent from the record entirely.
 *
 * @example
 * ```ts
 * directiveBoolean().parse("");    // true  (bare `{dev}` flag)
 * directiveBoolean().parse("off"); // false
 * ```
 */
export function directiveBoolean() {
  return z.stringbool({ truthy: BOOLEAN_TRUTHY, falsy: BOOLEAN_FALSY });
}

/**
 * A numeric attribute, parsed with `Number()` and accepted only when
 * finite - `Number("abc")` and `Number("1/2")` are both rejected with a
 * Zod issue rather than silently becoming `NaN`.
 *
 * @example
 * ```ts
 * directiveNumber().parse("3");   // 3
 * directiveNumber().parse("abc"); // Zod issue
 * ```
 */
export function directiveNumber() {
  return z.string().transform((value, ctx) => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
      ctx.addIssue({ code: "custom", message: `must be a finite number, received "${value}"` });
      return z.NEVER;
    }
    return parsed;
  });
}

/**
 * A comma- or space-separated list attribute, trimmed and with empty
 * entries dropped - `"a, b,  c"` and `"a b c"` both yield
 * `["a", "b", "c"]`.
 *
 * @example
 * ```ts
 * directiveList().parse("react, vue node"); // ["react", "vue", "node"]
 * ```
 */
export function directiveList() {
  return z.string().transform((value) =>
    value
      .split(/[,\s]+/)
      .map((item) => item.trim())
      .filter((item) => item.length > 0),
  );
}

/**
 * Splits a container directive's children into its label and body (D8).
 * `:::note[Heads up]` puts a paragraph with `data.directiveLabel === true`
 * as the directive's first child; a component that wants "attribute
 * `title`, falling back to the directive label" must extract and discard
 * that paragraph itself, or the label renders a second time as an ordinary
 * paragraph in the body.
 *
 * Only container directives can carry a label this way - a leaf
 * directive's children are phrasing content (`Array<PhrasingContent>`),
 * which cannot contain a `paragraph` at all, so there is no equivalent
 * ambiguity to resolve for leaf or text directives.
 *
 * @example
 * ```ts
 * // :::note[Heads up]
 * // Body text.
 * // :::
 * extractDirectiveLabel(node); // { label: "Heads up", children: [<paragraph>Body text.</paragraph>] }
 * ```
 */
export function extractDirectiveLabel(node: ContainerDirective): {
  label: string | null;
  children: RootContent[];
} {
  const [first, ...rest] = node.children;
  if (first !== undefined && first.type === "paragraph" && first.data?.directiveLabel === true) {
    return { label: mdastToString(first), children: rest };
  }
  return { label: null, children: node.children };
}

/**
 * Formats every issue in a `ZodError` as `"path: message"`, mirroring
 * `formatIssues` in `lib/content/schema.ts`. An issue at the schema root
 * (no field path) renders as `"(root): message"`.
 *
 * @example
 * ```ts
 * const result = calloutAttributesSchema.safeParse(attrs);
 * if (!result.success) {
 *   formatDirectiveIssues(result.error); // ['type: Invalid option: ...']
 * }
 * ```
 */
export function formatDirectiveIssues(error: z.ZodError): string[] {
  return error.issues.map((issue) => {
    const path = issue.path.length > 0 ? issue.path.join(".") : "(root)";
    return `${path}: ${issue.message}`;
  });
}
