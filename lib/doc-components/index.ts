/**
 * Public entry point for the documentation component bridge - the layer
 * between parsed markdown directives and the presentational components in
 * `components/docs-ui` (D3).
 *
 * This is the only module of `lib/doc-components` anything outside this
 * directory should import from, mirroring `lib/content/index.ts`'s own
 * rule. In practice `components/docs-ui/markdown-nodes.tsx` (the one place
 * directive dispatch happens, D6) and `components/docs-ui/*`'s individual
 * presentational components (which need a specific pure parser or the
 * icon vocabulary, not the whole bridge) still reach into individual
 * files directly - that's the existing, already-committed shape of this
 * codebase, not something this barrel silently changes. What this module
 * guarantees is a stable public surface for everything else: a future
 * landing page section, an admin tool, or a test that wants to resolve a
 * directive, build an install command, or parse a file tree without
 * knowing which file inside this directory happens to define it.
 *
 * `lib/content/index.ts` starts with `import "server-only"`; this module
 * does not, because unlike the content loader, nothing here touches the
 * filesystem - every export is pure logic over already-parsed mdast nodes
 * or plain strings, safe to import from a Client Component or a test.
 *
 * @example
 * ```ts
 * import { resolveDirective, buildInstallCommand } from "@/lib/doc-components";
 *
 * const resolution = resolveDirective(node);
 * const install = buildInstallCommand({ manager: "pnpm", packages: ["aniki-sdk"] });
 * ```
 */

export {
  DOC_COMPONENTS,
  defineDirective,
  issuesFromDirectiveError,
  reconstructTextDirectiveSource,
  resolveDirective,
} from "./registry";
export type { DocComponentEntry, DirectiveResolution, DirectiveResolutionFail, DirectiveResolutionOk } from "./registry";

export {
  DirectiveAttributeError,
  DirectiveStructureError,
  DocComponentError,
  UnknownDirectiveError,
} from "./errors";
export type { DocComponentErrorCode } from "./errors";

export { isContainerDirective, isLeafDirective, isTextDirective } from "./types";
export type { DirectiveKind, DirectiveNode } from "./types";

export {
  directiveBoolean,
  directiveList,
  directiveNumber,
  extractDirectiveLabel,
  formatDirectiveIssues,
  toAttributeRecord,
} from "./attributes";

export { parseCodeMeta } from "./code-meta";
export type { CodeMeta } from "./code-meta";

export { commandsOnly, parseTerminalLines } from "./terminal";
export type { TerminalLine } from "./terminal";

export { parseFileTree } from "./file-tree";
export type { FileTreeNode, FileTreeParseFail, FileTreeParseOk, FileTreeParseResult } from "./file-tree";

export { ICON_NAMES, iconAttribute, iconFor, resolveIcon } from "./icons";
export type { IconName } from "./icons";

export {
  readTabPreference,
  resolveTabPreference,
  tabPreferenceKey,
  writeTabPreference,
} from "./tab-preference";

export {
  buildInstallCommand,
  PACKAGE_MANAGER_STORAGE_KEY,
  PACKAGE_MANAGERS,
  readPackageManagerPreference,
  writePackageManagerPreference,
} from "./package-managers";
export type {
  BuildInstallCommandFail,
  BuildInstallCommandOk,
  BuildInstallCommandOptions,
  BuildInstallCommandResult,
  PackageManager,
} from "./package-managers";
