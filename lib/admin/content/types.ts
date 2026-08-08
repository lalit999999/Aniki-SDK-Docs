/**
 * Type definitions for the content authoring/publish surface.
 *
 * No runtime behaviour - a shared vocabulary for `lib/admin/content`'s
 * writer, workflow, and route handlers, mirroring how `lib/content/types.ts`
 * anchors the content system this module writes into.
 */

import type { DocFrontmatter } from "@/lib/content";

/**
 * An in-flight document, as authored in the editor: which version and slug
 * it belongs to, its frontmatter (validated against `docFrontmatterSchema`
 * before any write), and its markdown body (frontmatter already stripped,
 * leading `<h1>` included - the exact text a `.md` file's body should
 * contain).
 *
 * @example
 * ```ts
 * const draft: DocumentDraft = {
 *   version: "v1",
 *   slug: "tools",
 *   frontmatter: { title: "Tools", description: "...", category: "Reference", order: 3 },
 *   body: "# Tools\n\nBody text.",
 * };
 * ```
 */
export interface DocumentDraft {
  readonly version: string;
  readonly slug: string;
  readonly frontmatter: DocFrontmatter;
  readonly body: string;
}

/**
 * A lightweight, list-friendly view of a document - what the content
 * table (sub-task 7) renders one row from, without needing to load and
 * parse the full markdown body.
 *
 * @example
 * ```ts
 * const summary: DocumentSummary = {
 *   version: "v1",
 *   slug: "tools",
 *   title: "Tools",
 *   category: "Reference",
 *   order: 3,
 *   draft: false,
 *   deprecated: false,
 *   updatedAt: "2026-08-03",
 *   route: "/docs/tools",
 * };
 * ```
 */
export interface DocumentSummary {
  readonly version: string;
  readonly slug: string;
  readonly title: string;
  readonly category: DocFrontmatter["category"];
  readonly order: number;
  readonly draft: boolean;
  readonly deprecated: boolean;
  readonly updatedAt: string | null;
  readonly route: string;
}

/** A document's publish lifecycle state (D2/D6). */
export type PublishState = "draft" | "published";

/**
 * The outcome of a write. `changed` is `false` only for the D6 idempotent
 * "publish an already-published page" no-op - every other successful write
 * (create, update, unpublish) is `changed: true`.
 *
 * @example
 * ```ts
 * const result: WriteResult = { filePath: "content/docs/v1/tools.md", changed: true };
 * ```
 */
export interface WriteResult {
  readonly filePath: string;
  readonly changed: boolean;
}

/**
 * The result of validating a `DocumentDraft` before it touches disk (D5) -
 * every schema violation and index-level conflict found, aggregated rather
 * than stopping at the first.
 *
 * @example
 * ```ts
 * const report: ValidationReport = { valid: false, issues: ["description: Required"] };
 * ```
 */
export interface ValidationReport {
  readonly valid: boolean;
  readonly issues: readonly string[];
}

/** A reason `canPublish` (workflow.ts) found blocking a publish, paired
 * with a human-readable explanation for the UI's disabled-button tooltip. */
export interface PublishBlockReason {
  readonly reason: string;
}
