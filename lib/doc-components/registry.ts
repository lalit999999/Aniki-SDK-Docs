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
import { z } from "zod";
import type { ContainerDirective, TextDirective } from "mdast-util-directive";

import { ApiEndpoint, HTTP_METHODS } from "@/components/docs-ui/api-endpoint";
import { Callout, CALLOUT_TYPES } from "@/components/docs-ui/callout";
import { CardsGrid, DocCard } from "@/components/docs-ui/cards";
import { CodeGroup } from "@/components/docs-ui/code-group";
import { AccordionItemPanel, DocAccordion } from "@/components/docs-ui/doc-accordion";
import { DocBadge } from "@/components/docs-ui/doc-badge";
import { DocTabs, TabPanel } from "@/components/docs-ui/doc-tabs";
import { Feature, FeatureGrid } from "@/components/docs-ui/feature-grid";
import { FileTree } from "@/components/docs-ui/file-tree";
import { StepPanel, Steps } from "@/components/docs-ui/steps";

import { directiveBoolean, extractDirectiveLabel, toAttributeRecord, formatDirectiveIssues } from "./attributes";
import { parseFileTree } from "./file-tree";
import type { FileTreeNode } from "./file-tree";
import { iconAttribute } from "./icons";
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
  /**
   * Extra structural validation, or an attrs transform, beyond what a Zod
   * schema and `allowedChildren` can express from attributes alone - e.g.
   * a `:::tabs` container requiring every `:::tab` child to carry a
   * non-empty `label` (a per-child check, not an attribute of `tabs`
   * itself), or a `::::code-group` requiring every child to be a fenced
   * code block rather than a directive at all (so `allowedChildren`, which
   * only understands directive children, doesn't apply to it). Runs after
   * attribute validation and `allowedChildren`, given the raw container
   * node and the attrs computed so far; a problem it finds is reported the
   * same way an `allowedChildren` mismatch is, via
   * `DirectiveStructureError`, with every issue named rather than just the
   * first.
   */
  readonly deriveAttrs?: (
    node: ContainerDirective,
    attrs: Record<string, unknown>,
  ) => { ok: true; attrs: Record<string, unknown> } | { ok: false; issues: string[] };
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
  deriveAttrs?: (
    node: ContainerDirective,
    attrs: Attrs,
  ) => { ok: true; attrs: Attrs } | { ok: false; issues: string[] };
}): DocComponentEntry {
  const { component, schema } = config;
  return {
    kind: config.kind,
    schema: schema as unknown as z.ZodType<Record<string, unknown>>,
    allowedChildren: config.allowedChildren,
    deriveAttrs: config.deriveAttrs as DocComponentEntry["deriveAttrs"],
    render: (attrs, children) => createElement(component, attrs as Attrs, children),
  };
}

/**
 * Directive name -> component entry. Each component sub-task assigns its
 * entries here directly, e.g. `DOC_COMPONENTS.note = DOC_COMPONENTS.callout
 * = defineDirective({...})` for callout aliases (below).
 */
export const DOC_COMPONENTS: Record<string, DocComponentEntry> = {};

/**
 * `:::callout{type=...}` plus its six name aliases (`:::note`, `:::tip`,
 * ...) - one `defineDirective` per alias so each carries its own default
 * `type`, but all six point at the same `Callout` component. `type`
 * itself can still be overridden explicitly (`:::note{type=danger}`) since
 * every alias's schema accepts the full enum, not just its own default.
 */
function calloutAttributesSchema(defaultType: (typeof CALLOUT_TYPES)[number]) {
  return z.object({
    type: z.enum(CALLOUT_TYPES).default(defaultType),
    title: z.string().optional(),
  });
}

DOC_COMPONENTS.callout = defineDirective({
  kind: "containerDirective",
  schema: calloutAttributesSchema("note"),
  component: Callout,
});

for (const type of CALLOUT_TYPES) {
  DOC_COMPONENTS[type] = defineDirective({
    kind: "containerDirective",
    schema: calloutAttributesSchema(type),
    component: Callout,
  });
}

/**
 * `:::file-tree` - a folder structure authored as an ordinary nested
 * markdown list rather than directive syntax. `nodes` isn't an author-
 * facing attribute (the schema below never produces it); `deriveAttrs`
 * overwrites the placeholder with `parseFileTree`'s real result, or fails
 * the directive with `DIRECTIVE_STRUCTURE_INVALID` when the body isn't
 * exactly one list.
 */
DOC_COMPONENTS["file-tree"] = defineDirective({
  kind: "containerDirective",
  schema: z.object({}).transform(() => ({ nodes: [] as FileTreeNode[] })),
  component: FileTree,
  deriveAttrs: (node, attrs) => {
    const { children } = extractDirectiveLabel(node);
    const result = parseFileTree(children);
    return result.ok ? { ok: true, attrs: { ...attrs, nodes: result.nodes } } : result;
  },
});

/**
 * `:::api-endpoint{method path auth deprecated}`. `method` and `path` are
 * independent top-level Zod fields rather than one `superRefine` over the
 * whole object, so `safeParse` aggregates issues from both when both are
 * wrong - a `DirectiveAttributeError` names every bad attribute in one
 * pass, not just the first one it happens to check (the same aggregation
 * every other schema in this file already gets for free from `z.object`).
 */
const apiEndpointAttributesSchema = z.object({
  method: z.string().transform((value, ctx) => {
    const upper = value.toUpperCase();
    if (!(HTTP_METHODS as readonly string[]).includes(upper)) {
      ctx.addIssue({
        code: "custom",
        message: `must be one of ${HTTP_METHODS.join(", ")}, received "${value}"`,
      });
      return z.NEVER;
    }
    return upper as (typeof HTTP_METHODS)[number];
  }),
  path: z.string().transform((value, ctx) => {
    if (!value.startsWith("/")) {
      ctx.addIssue({ code: "custom", message: `must start with "/", received "${value}"` });
      return z.NEVER;
    }
    return value;
  }),
  auth: directiveBoolean().optional(),
  deprecated: directiveBoolean().optional(),
});

DOC_COMPONENTS["api-endpoint"] = defineDirective({
  kind: "containerDirective",
  schema: apiEndpointAttributesSchema,
  component: ApiEndpoint,
});

/**
 * Checks every `:::tab` child of a `:::::tabs` container for a non-empty
 * `label` attribute, naming every offending index rather than stopping at
 * the first - a missing label is a structure issue on the *parent*, not an
 * attribute error on the individual `tab` (which is why this lives in
 * `tabs`'s `deriveAttrs` rather than in `tab`'s own schema): the whole
 * point is one aggregated, useful error instead of one opaque fallback per
 * broken tab.
 */
function validateTabLabels(node: ContainerDirective): string[] {
  const issues: string[] = [];
  node.children.forEach((child, index) => {
    if (isContainerDirective(child) && child.name === "tab") {
      const label = toAttributeRecord(child).label;
      if (label === undefined || label.trim().length === 0) {
        issues.push(`tab at index ${index} is missing a required "label" attribute`);
      }
    }
  });
  return issues;
}

DOC_COMPONENTS.tabs = defineDirective({
  kind: "containerDirective",
  schema: z.object({ sync: z.string().optional() }),
  component: DocTabs,
  allowedChildren: ["tab"],
  deriveAttrs: (node, attrs) => {
    const issues = validateTabLabels(node);
    return issues.length > 0 ? { ok: false, issues } : { ok: true, attrs };
  },
});

/** Never dispatched on its own (D3/D4) - only ever encountered as a
 * `:::tab` child while `tabs` recurses into its body via `MarkdownNodes`,
 * by which point `tabs`'s own `deriveAttrs` has already guaranteed every
 * such child carries a non-empty `label`. */
DOC_COMPONENTS.tab = defineDirective({
  kind: "containerDirective",
  schema: z.object({ label: z.string() }),
  component: TabPanel,
});

/**
 * `::::code-group` requires every child to be a fenced code block, not a
 * directive - `allowedChildren` only understands directive-named children,
 * so this check lives in `deriveAttrs` instead, naming the offending index
 * and node type for anything else (most often the D7 mismatched-colon
 * mistake leaving stray paragraphs behind).
 */
DOC_COMPONENTS["code-group"] = defineDirective({
  kind: "containerDirective",
  schema: z.object({}),
  component: CodeGroup,
  deriveAttrs: (node, attrs) => {
    const issues: string[] = [];
    node.children.forEach((child, index) => {
      if (child.type !== "code") {
        issues.push(`expected only fenced code blocks, found a "${child.type}" node at index ${index}`);
      }
    });
    return issues.length > 0 ? { ok: false, issues } : { ok: true, attrs };
  },
});

/**
 * `::::steps` / `:::step{title="..."}`, the same registry pattern as
 * `tabs`/`tab` (T6): `step` is only ever encountered as a child while
 * `steps` recurses into its body, never dispatched on its own. No
 * `deriveAttrs` needed here - unlike a tab's `label`, a step's `title` is
 * optional (falls back to nothing rather than needing to be caught as a
 * structure issue), and D8's generic label-into-`title` merge in
 * `resolveDirective` already covers "attribute, falling back to the
 * directive label" with no extra code.
 */
DOC_COMPONENTS.steps = defineDirective({
  kind: "containerDirective",
  schema: z.object({}),
  component: Steps,
  allowedChildren: ["step"],
});

DOC_COMPONENTS.step = defineDirective({
  kind: "containerDirective",
  schema: z.object({ title: z.string().optional() }),
  component: StepPanel,
});

/**
 * Under `type="single"`, at most one `:::accordion-item` may carry `open`
 * - Radix's own `Accordion` with `type="single"` accepts only one default
 * value, so two items claiming to be the default-open one is genuinely
 * ambiguous, not just redundant. Reports every extra `open` beyond the
 * first as its own issue (naming both indices) rather than silently
 * keeping the first and discarding the rest with no explanation.
 */
function validateSingleAccordionOpen(node: ContainerDirective): string[] {
  const isOpen = directiveBoolean();
  const openIndexes: number[] = [];
  node.children.forEach((child, index) => {
    if (isContainerDirective(child) && child.name === "accordion-item") {
      const raw = toAttributeRecord(child).open;
      if (raw !== undefined && isOpen.safeParse(raw).data === true) {
        openIndexes.push(index);
      }
    }
  });
  if (openIndexes.length <= 1) {
    return [];
  }
  const [first, ...rest] = openIndexes;
  return rest.map(
    (index) =>
      `accordion-item at index ${index} also has "open", but type="single" allows only one default-open item (the first, at index ${first})`,
  );
}

DOC_COMPONENTS.accordion = defineDirective({
  kind: "containerDirective",
  schema: z.object({ type: z.enum(["single", "multiple"]).default("single") }),
  component: DocAccordion,
  allowedChildren: ["accordion-item"],
  deriveAttrs: (node, attrs) => {
    if (attrs.type !== "single") {
      return { ok: true, attrs };
    }
    const issues = validateSingleAccordionOpen(node);
    return issues.length > 0 ? { ok: false, issues } : { ok: true, attrs };
  },
});

/** Never dispatched on its own (D3/D4) - see `AccordionItemPanel`. */
DOC_COMPONENTS["accordion-item"] = defineDirective({
  kind: "containerDirective",
  schema: z.object({ title: z.string().optional(), open: directiveBoolean().optional() }),
  component: AccordionItemPanel,
});

/** Maps a `columns` enum string to its literal numeric value, keeping the
 * precise `1 | 2 | 3` type `CardsGrid` expects - `.transform(Number)`
 * would widen it to plain `number` instead. */
const CARDS_COLUMN_VALUES = { "1": 1, "2": 2, "3": 3 } as const;

/**
 * `::::cards{columns}` / `:::card{title icon href}`. `card` is fully
 * self-contained (unlike `tab`/`step`/`accordion-item`, `cards` never
 * needs to read anything back out of it) - it renders its own title, icon,
 * and link chrome, so `CardsGrid` is purely a responsive grid wrapper with
 * no compound-component machinery at all.
 */
DOC_COMPONENTS.cards = defineDirective({
  kind: "containerDirective",
  schema: z.object({
    columns: z
      .enum(["1", "2", "3"])
      .default("3")
      .transform((value) => CARDS_COLUMN_VALUES[value]),
  }),
  component: CardsGrid,
  allowedChildren: ["card"],
});

DOC_COMPONENTS.card = defineDirective({
  kind: "containerDirective",
  schema: z.object({
    title: z.string().optional(),
    icon: iconAttribute(),
    href: z.string().optional(),
  }),
  component: DocCard,
});

/** See `CARDS_COLUMN_VALUES` - same reasoning, narrower range. */
const FEATURES_COLUMN_VALUES = { "2": 2, "3": 3 } as const;

/**
 * `::::features{columns}` / `:::feature{title icon}` - the marketing-
 * leaning sibling of `cards`/`card`, same self-contained shape. `columns`
 * is closed to 2|3 (never 1 - a single-column "grid" of features reads as
 * a plain list, which the grammar doesn't offer a features-specific reason
 * to want over just writing prose).
 */
DOC_COMPONENTS.features = defineDirective({
  kind: "containerDirective",
  schema: z.object({
    columns: z
      .enum(["2", "3"])
      .default("3")
      .transform((value) => FEATURES_COLUMN_VALUES[value]),
  }),
  component: FeatureGrid,
  allowedChildren: ["feature"],
});

DOC_COMPONENTS.feature = defineDirective({
  kind: "containerDirective",
  schema: z.object({ title: z.string().optional(), icon: iconAttribute() }),
  component: Feature,
});

/**
 * `:badge[Label]{variant}` - the first `textDirective` entry in this
 * registry. Needs no change to `markdown-nodes.tsx`'s `TextDirectiveNode`,
 * which already dispatches every text directive through `resolveDirective`
 * generically (D4); an unregistered text directive is unaffected and still
 * falls through to `reconstructTextDirectiveSource`; that fallback keys on
 * the directive's *name* being absent from `DOC_COMPONENTS`, not on
 * whether any text directive at all has been registered.
 */
DOC_COMPONENTS.badge = defineDirective({
  kind: "textDirective",
  schema: z.object({ variant: z.enum(["default", "secondary", "outline", "destructive"]).default("default") }),
  component: DocBadge,
});

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

  // D8: "extract [the label] as the title when no title attribute is
  // given" - generically, for any component whose schema has a `title`
  // field, not just callouts, so this only needs writing once. A `title`
  // attribute always wins when both are present.
  let attrs =
    label !== null && attrsResult.data.title === undefined
      ? { ...attrsResult.data, title: label }
      : attrsResult.data;

  if (entry.deriveAttrs !== undefined && isContainerDirective(node)) {
    const derived = entry.deriveAttrs(node, attrs);
    if (!derived.ok) {
      return {
        ok: false,
        error: new DirectiveStructureError(`invalid structure for ":::${node.name}"`, {
          name: node.name,
          issues: derived.issues,
        }),
      };
    }
    attrs = derived.attrs;
  }

  return {
    ok: true,
    name: node.name,
    attrs,
    label,
    render: (children: ReactNode) => entry.render(attrs, children),
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
