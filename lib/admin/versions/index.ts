/**
 * Public entry point for the version management admin surface: session
 * verification, registry inspection and drift detection, and atomic
 * scaffolding of new versions.
 *
 * `import "server-only"` (via `./access`, `./inspect`, and `./scaffold`)
 * turns an accidental import into a Client Component into a build-time
 * error, since every function here ultimately reads cookies, reads
 * `content/docs`, or writes `config/versions.ts`.
 *
 * @example
 * ```ts
 * import { requireVersionsAdmin, inspectVersions, scaffoldVersion } from "@/lib/admin/versions";
 *
 * const { username } = await requireVersionsAdmin();
 * const report = await inspectVersions();
 * ```
 */

export { requireVersionsAdmin } from "./access";

export { detectDrift, hasDrift, inspectVersions, validateNewVersionInput } from "./inspect";

export { renderVersionsRegion, scaffoldVersion } from "./scaffold";
export type { ScaffoldVersionOptions, ScaffoldVersionResult } from "./scaffold";

export {
  AdminVersionsError,
  InvalidVersionInputError,
  mapVersionsAdminError,
  VersionDriftConflictError,
  VersionRegistryWriteError,
  VersionScaffoldError,
  VersionsAdminUnauthorizedError,
} from "./errors";
export type { AdminVersionsErrorCode, VersionsAdminErrorResponse } from "./errors";

export type {
  NewVersionInput,
  VersionDriftReport,
  VersionInspectionEntry,
  VersionsInspectionReport,
} from "./types";
