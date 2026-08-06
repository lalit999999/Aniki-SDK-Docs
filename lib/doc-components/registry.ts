/**
 * The documentation component registry - the single source of truth for
 * which directive names resolve to which presentational component, and
 * the only place that knowledge lives (D4).
 *
 * `DOC_COMPONENTS` starts empty: every directive resolves to
 * `UnknownDirectiveError` until a later sub-task calls `defineDirective`
 * and assigns the result here. Adding a component is then exactly two
 * changes - a presentational component in `components/docs-ui`, and one
 * entry in this file - `components/docs-ui/markdown-nodes.tsx` never
 * needs to change, because its directive dispatch already goes through
 * `resolveDirective` generically.
 *
 * This module uses `createElement` instead of JSX so it can stay a `.ts`
 * file with zero JSX syntax (D3): it holds component *references* as
 * plain values (an ordinary import, no different from storing a
 * function), which is not the same as rendering them - the actual
 * combination of a directive's resolved data with JSX markup only ever
 * happens in `components/docs-ui/markdown-nodes.tsx` (D6).
 */

import { createElement } from "react";
import type { ComponentType, ReactNode } from "react";
import type { z } from "zod";
import type { ContainerDirective, TextDirective } from "mdast-util-directive";

import { extractDirectiveLabel, toAttributeRecord, formatDirectiveIssues } from "./attributes";
import { isContainerDirective, isLeafDirective } from "./types";
import type { DirectiveKind, DirectiveNode } from "./types";
import {
  DirectiveAttributeError,
  DirectiveStructureError,
  DocComponentError,
  UnknownDirectiveError,
} from "./errors";

/**
 * One entry in `DOC_COMPONENTS`. `schema` and `render` are erased to
 * `Record<string, unknown>` so entries with different attribute shapes
 * can share one map type (see `defineDirective`) - `resolveDirective`
 * always calls `render` with exactly the object `schema.safeParse` just
 * produced, so the erasure never actually loses type safety at the
 * point that matters.
 */
export interface DocComponentEntry {
  readonly kind: DirectiveKind;
  readonly schema: z.ZodType<Record<string, unknown>>;
  readonly render: (attrs: Record<string, unknown>, children: ReactNode) => ReactNode;
  /** For container directives whose children must themselves be specific
   * directives (e.g. `:::tabs` only containing `:::tab`) - the D7 nested-
   * container mistake is the most common way this fails. Left `undefined`
   * for components with no structural constraint on their children. */
  readonly allowedChildren?: readonly string[];
}

/**
 * Builds a `DocComponentEntry` from a strongly-typed schema and
 * presentational component, erasing `Attrs` away for storage in
 * `DOC_COMPONENTS`. Safe by construction: `resolveDirective` only ever
 * calls the returned `render` with the exact value `schema.safeParse`
 * produced immediately before it, so the value passed to `component`
 * always actually has shape `Attrs`, even though `DocComponentEntry`'s
 * erased type can't express that per-entry guarantee to the compiler.
 *
 * @example
 * ```ts
 * DOC_COMPONENTS.callout = defineDirective({
 *   kind: "containerDirective",
 *   schema: calloutAttributesSchema,
 *   component: Callout,
 * });
 * ```
 */
export function defineDirective<Attrs extends Record<string, unknown>>(config: {
  kind: DirectiveKind;
  schema: z.ZodType<Attrs>;
  component: ComponentType<Attrs & { children?: ReactNode }>;
  allowedChildren?: readonly string[];
}): DocComponentEntry {
  const { component, schema } = config;
  return {
    kind: config.kind,
    schema: schema as unknown as z.ZodType<Record<string, unknown>>,
    allowedChildren: config.allowedChildren,
    render: (attrs, children) => createElement(component, attrs as Attrs, children),
  };
}

/**
 * Directive name -> component entry. Empty until a component sub-task
 * (T3 onward) assigns entries here directly, e.g. `DOC_COMPONENTS.note =
 * DOC_COMPONENTS.callout = defineDirective({...})` for callout aliases.
 */
export const DOC_COMPONENTS: Record<string, DocComponentEntry> = {};

/** A directive that resolved cleanly against `DOC_COMPONENTS`. */
export interface DirectiveResolutionOk {
  readonly ok: true;
  readonly name: string;
  readonly attrs: Record<string, unknown>;
  /** The D8 directive label (`:::name[Label]`), or `null` if the
   * directive has none. Always `null` for leaf/text directives - see
   * `extractDirectiveLabel`. */
  readonly label: string | null;
  /** Renders the resolved component with its already-validated attrs and
   * the given (already-rendered) body. */
  readonly render: (children: ReactNode) => ReactNode;
}

/** A directive that could not be resolved - D5's "never throw" path. */
export interface DirectiveResolutionFail {
  readonly ok: false;
  readonly error: DocComponentError;
}

export type DirectiveResolution = DirectiveResolutionOk | DirectiveResolutionFail;

function validateAllowedChildren(node: ContainerDirective, allowedChildren: readonly string[]): string[] {
  const issues: string[] = [];
  for (const child of node.children) {
    const childName = isContainerDirective(child) || isLeafDirective(child) ? child.name : null;
    if (childName === null) {
      issues.push(
        `expected only ${allowedChildren.map((name) => `":${name}"`).join(", ")} children, found a ` +
          `"${child.type}" node - check for mismatched colon counts on a nested directive (D7)`,
      );
    } else if (!allowedChildren.includes(childName)) {
      issues.push(
        `expected only ${allowedChildren.map((name) => `":${name}"`).join(", ")} children, found ":${childName}"`,
      );
    }
  }
  return issues;
}

const KIND_SYNTAX: Record<DirectiveKind, string> = {
  containerDirective: ":::",
  leafDirective: "::",
  textDirective: ":",
};

/**
 * Resolves a directive node against `DOC_COMPONENTS` - the single entry
 * point `MarkdownNodes` dispatches every `containerDirective` /
 * `leafDirective` / `textDirective` node through. Never throws (D5): an
 * unknown name, a directive written with the wrong syntax for its
 * registered kind, a failed attribute schema, or an invalid child
 * structure all come back as `{ ok: false, error }` for the caller to
 * render as a fallback instead.
 *
 * @example
 * ```ts
 * const resolution = resolveDirective(node);
 * if (resolution.ok) {
 *   return resolution.render(renderedChildren);
 * }
 * // fall back to UnknownDirective
 * ```
 */
export function resolveDirective(node: DirectiveNode): DirectiveResolution {
  const entry = DOC_COMPONENTS[node.name];
  if (entry === undefined) {
    return {
      ok: false,
      error: new UnknownDirectiveError(`unknown directive "${KIND_SYNTAX[node.type]}${node.name}"`, {
        name: node.name,
        kind: node.type,
      }),
    };
  }

  if (entry.kind !== node.type) {
    return {
      ok: false,
      error: new DirectiveStructureError(
        `"${node.name}" is registered as a ${entry.kind} but was written as a ${node.type}`,
        {
          name: node.name,
          issues: [`write it as ${KIND_SYNTAX[entry.kind]}${node.name} instead of ${KIND_SYNTAX[node.type]}${node.name}`],
        },
      ),
    };
  }

  const attrsResult = entry.schema.safeParse(toAttributeRecord(node));
  if (!attrsResult.success) {
    return {
      ok: false,
      error: new DirectiveAttributeError(`invalid attributes for "${KIND_SYNTAX[node.type]}${node.name}"`, {
        name: node.name,
        issues: formatDirectiveIssues(attrsResult.error),
      }),
    };
  }

  if (entry.allowedChildren !== undefined && isContainerDirective(node)) {
    const structureIssues = validateAllowedChildren(node, entry.allowedChildren);
    if (structureIssues.length > 0) {
      return {
        ok: false,
        error: new DirectiveStructureError(`invalid structure for ":::${node.name}"`, {
          name: node.name,
          issues: structureIssues,
        }),
      };
    }
  }

  const label = isContainerDirective(node) ? extractDirectiveLabel(node).label : null;

  return {
    ok: true,
    name: node.name,
    attrs: attrsResult.data,
    label,
    render: (children: ReactNode) => entry.render(attrsResult.data, children),
  };
}

/**
 * Builds `:name{attr="value" flag}` from a text directive's name and
 * attributes - the D5/§3.1 fallback for a directive with no children,
 * which happens when an unregistered text directive fires mid-word
 * (`foo:bar` parses `bar` away entirely, leaving nothing in
 * `node.children` to fall back to). Reconstructing the source rather
 * than rendering nothing means the author's original text survives even
 * though it was never a real directive.
 *
 * @example
 * ```ts
 * // "See foo:bar for details." -> textDirective name="bar", no children
 * reconstructTextDirectiveSource(node); // ":bar"
 * ```
 */
export function reconstructTextDirectiveSource(node: TextDirective): string {
  const attrs = toAttributeRecord(node);
  const entries = Object.entries(attrs);
  if (entries.length === 0) {
    return `:${node.name}`;
  }
  const attrText = entries
    .map(([key, value]) => (value === "" ? key : `${key}="${value}"`))
    .join(" ");
  return `:${node.name}{${attrText}}`;
}

/**
 * Extracts a human-readable issue list from a `DocComponentError` for
 * display in the `UnknownDirective` fallback card: `issues` from context
 * when the error carries one (attribute/structure errors), or the
 * error's own message otherwise (an unknown directive has nothing more
 * specific to say).
 */
export function issuesFromDirectiveError(error: DocComponentError): string[] {
  const { issues } = error.context;
  if (Array.isArray(issues) && issues.every((issue): issue is string => typeof issue === "string")) {
    return issues;
  }
  return [error.message];
}
