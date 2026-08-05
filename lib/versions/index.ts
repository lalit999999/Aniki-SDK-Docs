/**
 * Public entry point for the client-safe documentation version registry.
 *
 * Unlike `@/lib/content`, this module carries no `server-only` guard: it
 * has zero filesystem access, so it is safe to import at runtime from
 * Client Components (the version switcher, T4) and at build time from
 * `next.config.ts` (T5).
 *
 * @example
 * ```ts
 * import { getLatestVersion, getVersions } from "@/lib/versions";
 *
 * const latest = getLatestVersion();
 * const all = getVersions();
 * ```
 */

export {
  findVersionById,
  getLatestVersion,
  getVersionById,
  getVersions,
  isKnownVersionId,
  isLatestVersionId,
  resolveVersionId,
  validateVersions,
  VERSION_ID_PATTERN,
} from "./registry";

export { UnknownVersionError, VersionConfigError, VersionsError } from "./errors";

export { docsIndexRoute, resolveDocsPath } from "./route";
export type { ResolvedDocsPath } from "./route";

export type { DocsVersion, DocsVersionStatus, DocsVersionSummary } from "./types";
