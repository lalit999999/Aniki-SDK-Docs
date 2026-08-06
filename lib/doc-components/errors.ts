/**
 * Error taxonomy for the documentation component bridge.
 *
 * Mirrors `lib/content/errors.ts` structurally (abstract base, `readonly
 * code`, frozen `context`, `toJSON()`) so the two error families are
 * recognizable as siblings, but they are deliberately not unified into one
 * hierarchy: a `DocComponentError` never propagates out of a render (D5 -
 * `resolveDirective` catches it and returns a fallback), while a
 * `ContentError` is allowed to fail a build. Conflating them would make it
 * unclear which behaviour a given `instanceof` check implies.
 */

import type { DirectiveKind } from "./types";

/**
 * Discriminant for every error this module can produce. Kept as a union
 * (rather than deriving it from the class list) so it can be imported
 * without pulling in the classes themselves.
 */
export type DocComponentErrorCode =
  | "UNKNOWN_DIRECTIVE"
  | "DIRECTIVE_ATTRIBUTES_INVALID"
  | "DIRECTIVE_STRUCTURE_INVALID";

/**
 * Base class for every error the documentation component bridge produces.
 * Not thrown across the `resolveDirective` boundary - see D5: a malformed
 * directive must never crash a page, so these are constructed and returned
 * inside a `{ ok: false, error }` result, not thrown.
 *
 * @example
 * ```ts
 * const result = resolveDirective(node);
 * if (!result.ok && result.error instanceof DocComponentError) {
 *   console.error(result.error.code, result.error.context);
 * }
 * ```
 */
export abstract class DocComponentError extends Error {
  abstract readonly code: DocComponentErrorCode;
  readonly context: Readonly<Record<string, unknown>>;

  constructor(
    message: string,
    options?: { context?: Record<string, unknown>; cause?: unknown },
  ) {
    super(message, options?.cause !== undefined ? { cause: options.cause } : undefined);
    this.name = this.constructor.name;
    this.context = Object.freeze({ ...(options?.context ?? {}) });
  }

  /**
   * Plain-object representation suitable for the D5 development fallback
   * card, or for logging.
   */
  toJSON(): {
    name: string;
    code: DocComponentErrorCode;
    message: string;
    context: Readonly<Record<string, unknown>>;
  } {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      context: this.context,
    };
  }
}

/**
 * Produced when a directive's name has no entry in `DOC_COMPONENTS`
 * (`lib/doc-components/registry.ts`) - a typo, or a directive from a later
 * part of Step 8 that hasn't been registered yet.
 *
 * @example
 * ```ts
 * new UnknownDirectiveError('unknown directive ":::wharning"', {
 *   name: "wharning",
 *   kind: "containerDirective",
 * });
 * ```
 */
export class UnknownDirectiveError extends DocComponentError {
  readonly code = "UNKNOWN_DIRECTIVE" as const;

  constructor(message: string, context: { name: string; kind: DirectiveKind }) {
    super(message, { context });
  }
}

/**
 * Produced when a directive's attributes fail its registered Zod schema.
 * `issues` lists every failing field (D9's coercers surface one issue per
 * bad attribute), not just the first, so a single fix cycle catches them
 * all.
 *
 * @example
 * ```ts
 * new DirectiveAttributeError('invalid attributes for ":::callout"', {
 *   name: "callout",
 *   issues: ['type: Invalid option: expected one of "note"|"tip"|...'],
 * });
 * ```
 */
export class DirectiveAttributeError extends DocComponentError {
  readonly code = "DIRECTIVE_ATTRIBUTES_INVALID" as const;

  constructor(message: string, context: { name: string; issues: readonly string[] }) {
    super(message, { context });
  }
}

/**
 * Produced when a directive's children don't match the shape its component
 * requires - e.g. a `:::tabs` containing something other than `:::tab`
 * children, or the D7 nested-container mistake (matching colon counts on
 * an outer and inner directive, which closes the outer early and leaves a
 * literal `":::"` paragraph behind).
 *
 * @example
 * ```ts
 * new DirectiveStructureError('invalid structure for ":::tabs"', {
 *   name: "tabs",
 *   issues: ["expected only \"tab\" children, found \"paragraph\""],
 * });
 * ```
 */
export class DirectiveStructureError extends DocComponentError {
  readonly code = "DIRECTIVE_STRUCTURE_INVALID" as const;

  constructor(message: string, context: { name: string; issues: readonly string[] }) {
    super(message, { context });
  }
}
