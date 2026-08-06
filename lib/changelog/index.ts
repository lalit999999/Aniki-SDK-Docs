/**
 * Public entry point for the changelog content system - mirrors
 * `lib/content/index.ts`. `import "server-only"` turns an accidental
 * import into a Client Component into a build-time error instead of a
 * confusing runtime `fs` bundling failure.
 *
 * @example
 * ```ts
 * import { getAllReleases, getReleaseBySlug } from "@/lib/changelog";
 *
 * const releases = await getAllReleases();
 * const release = await getReleaseBySlug("v1.0.0");
 * ```
 */

import "server-only";

export {
  clearChangelogCache,
  findReleaseBySlug,
  getAdjacentReleases,
  getAllReleaseMeta,
  getAllReleases,
  getReleaseBySlug,
  getReleaseSlugs,
} from "./loader";

export {
  ChangelogDirectoryError,
  ChangelogError,
  DuplicateReleaseError,
  ReleaseFrontmatterInvalidError,
  ReleaseNotFoundError,
} from "./errors";
export type { ChangelogErrorCode } from "./errors";

export { parseReleaseFrontmatter, releaseFrontmatterSchema } from "./schema";

export { compareSemver } from "./semver";

export { getChangelogDirectory, listReleaseFiles, readReleaseFile } from "./paths";

export type {
  AdjacentReleases,
  Release,
  ReleaseFrontmatter,
  ReleaseMeta,
  ReleaseStatus,
} from "./types";
