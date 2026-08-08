/**
 * Atomic scaffolding of a new documentation version (D4): writes the
 * `config/versions.ts` registry region and the `content/docs/<id>`
 * directory together, or neither. `assertVersionDirectories()` in
 * `lib/content/paths.ts` fails the whole site build the moment either one
 * exists without the other (T1) - "atomic" here isn't a nicety, it's what
 * keeps `next build` alive after every scaffold.
 *
 * Sequence: build the proposed registry in memory -> validate it (T2/T3) ->
 * snapshot the current `config/versions.ts` -> copy the source version's
 * content directory to a temp sibling -> write the registry region ->
 * `rename` the temp directory into place -> on any failure, restore the
 * registry file from the snapshot and remove the temp directory.
 */

import "server-only";

import { randomBytes } from "node:crypto";
import { cp, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import { getContentRoot } from "@/lib/content";
import { getVersions, validateVersions, VersionConfigError } from "@/lib/versions";
import type { DocsVersion } from "@/lib/versions";

import {
  InvalidVersionInputError,
  VersionDriftConflictError,
  VersionRegistryWriteError,
  VersionScaffoldError,
} from "./errors";
import { detectDrift, hasDrift, validateNewVersionInput } from "./inspect";
import type { NewVersionInput } from "./types";

const DEFAULT_REGISTRY_FILE_PATH = path.join(process.cwd(), "config", "versions.ts");
const START_MARKER = "aniki:versions:start";
const END_MARKER = "aniki:versions:end";

/** Result of a successful {@link scaffoldVersion} call: the full proposed
 * registry that was written, newest-first. */
export interface ScaffoldVersionResult {
  versions: readonly DocsVersion[];
}

/** Options for {@link scaffoldVersion}. The registry file path is only
 * ever overridden by tests, which exercise the write/rollback sequence
 * against a disposable temp copy instead of the repository's real
 * `config/versions.ts`. */
export interface ScaffoldVersionOptions {
  registryFilePath?: string;
}

function quote(value: string): string {
  return JSON.stringify(value);
}

/**
 * Renders the TypeScript source for the delimited `config/versions.ts`
 * region: one object literal per version, in array order, matching the
 * file's existing style (2-space indent, double-quoted strings, trailing
 * commas). Optional fields are only emitted when present.
 *
 * @example
 * ```ts
 * renderVersionsRegion([
 *   { id: "v1", label: "v1.0", status: "latest", releasedAt: "2026-08-03" },
 * ]);
 * // '  {\n    id: "v1",\n    label: "v1.0",\n    status: "latest",\n    releasedAt: "2026-08-03",\n  },'
 * ```
 */
export function renderVersionsRegion(versions: readonly DocsVersion[]): string {
  return versions
    .map((version) => {
      const lines = [
        `  {`,
        `    id: ${quote(version.id)},`,
        `    label: ${quote(version.label)},`,
        `    status: ${quote(version.status)},`,
        `    releasedAt: ${quote(version.releasedAt)},`,
      ];
      if (version.sdkVersion !== undefined) {
        lines.push(`    sdkVersion: ${quote(version.sdkVersion)},`);
      }
      if (version.migrationGuideSlug !== undefined) {
        lines.push(`    migrationGuideSlug: ${quote(version.migrationGuideSlug)},`);
      }
      if (version.notice !== undefined) {
        lines.push(`    notice: ${quote(version.notice)},`);
      }
      lines.push(`  },`);
      return lines.join("\n");
    })
    .join("\n");
}

function replaceVersionsRegion(source: string, regionBody: string, registryFilePath: string): string {
  const startMarkerIndex = source.indexOf(START_MARKER);
  const endMarkerIndex = source.indexOf(END_MARKER);
  if (startMarkerIndex === -1 || endMarkerIndex === -1 || endMarkerIndex < startMarkerIndex) {
    throw new VersionRegistryWriteError(
      `${registryFilePath} is missing the aniki:versions:start/end region markers`,
      { filePath: registryFilePath },
    );
  }

  const afterStartMarkerLine = source.indexOf("\n", startMarkerIndex);
  const startOfEndMarkerLine = source.lastIndexOf("\n", endMarkerIndex) + 1;
  if (afterStartMarkerLine === -1 || startOfEndMarkerLine <= startMarkerIndex) {
    throw new VersionRegistryWriteError(
      `${registryFilePath} has malformed aniki:versions region markers`,
      { filePath: registryFilePath },
    );
  }

  const before = source.slice(0, afterStartMarkerLine + 1);
  const after = source.slice(startOfEndMarkerLine);
  return `${before}${regionBody}\n${after}`;
}

/**
 * Builds the proposed full registry for a new version, newest-first: the
 * new entry first (its `releasedAt` is already validated as newest by
 * `validateNewVersionInput`), followed by every existing entry - with the
 * previous latest demoted to `"maintenance"` in the same array when
 * `promoteToLatest` is `true` (T3).
 */
function buildProposedVersions(input: NewVersionInput, current: readonly DocsVersion[]): DocsVersion[] {
  const newEntry: DocsVersion = {
    id: input.id,
    label: input.label,
    status: input.promoteToLatest ? "latest" : "maintenance",
    releasedAt: input.releasedAt,
    ...(input.migrationGuideSlug !== undefined ? { migrationGuideSlug: input.migrationGuideSlug } : {}),
  };

  const rest = input.promoteToLatest
    ? current.map((version): DocsVersion => (version.status === "latest" ? { ...version, status: "maintenance" } : version))
    : [...current];

  return [newEntry, ...rest];
}

async function removeTempDirectory(tempDir: string): Promise<void> {
  await rm(tempDir, { recursive: true, force: true }).catch(() => undefined);
}

/**
 * Scaffolds a new documentation version: copies `sourceVersionId`'s content
 * directory to `content/docs/<id>` and adds a matching entry to
 * `config/versions.ts`, atomically (D4) - both succeed, or neither is left
 * changed.
 *
 * Refuses to run when {@link detectDrift} reports anything (declared
 * versions and on-disk directories already disagree): scaffolding on top
 * of an already-broken registry would only compound the damage.
 *
 * @throws {VersionDriftConflictError} if the registry and content
 * directories are already drifted - nothing on disk is touched.
 * @throws {InvalidVersionInputError} if `input` fails
 * {@link validateNewVersionInput} or the full-registry
 * {@link validateVersions} safety net - nothing on disk is touched.
 * @throws {VersionScaffoldError} if copying the source content directory
 * fails, or if moving the scaffolded directory into place fails after the
 * registry file was already rewritten (in which case the registry file is
 * restored from its snapshot before this throws).
 * @throws {VersionRegistryWriteError} if the registry file can't be read,
 * is missing its region markers, or can't be written.
 *
 * @example
 * ```ts
 * const result = await scaffoldVersion({
 *   id: "v2",
 *   label: "v2.0",
 *   releasedAt: "2026-09-01",
 *   sourceVersionId: "v1",
 *   promoteToLatest: true,
 * });
 * result.versions.map((v) => v.id); // ["v2", "v1"]
 * ```
 */
export async function scaffoldVersion(
  input: NewVersionInput,
  options: ScaffoldVersionOptions = {},
): Promise<ScaffoldVersionResult> {
  const registryFilePath = options.registryFilePath ?? DEFAULT_REGISTRY_FILE_PATH;

  const drift = await detectDrift();
  if (hasDrift(drift)) {
    throw new VersionDriftConflictError(
      "cannot scaffold a new version while the registry and content directories disagree",
      drift,
    );
  }

  const inputIssues = await validateNewVersionInput(input);
  if (inputIssues.length > 0) {
    throw new InvalidVersionInputError("invalid new version input", { issues: inputIssues });
  }

  const current = getVersions();
  const proposed = buildProposedVersions(input, current);

  try {
    validateVersions(proposed);
  } catch (error) {
    if (error instanceof VersionConfigError) {
      throw new InvalidVersionInputError("proposed version registry is invalid", {
        issues: error.context.violations as readonly string[],
      });
    }
    throw error;
  }

  const originalSource = await readRegistryFile(registryFilePath);

  const contentRoot = getContentRoot();
  const sourceDir = path.join(contentRoot, input.sourceVersionId);
  const finalDir = path.join(contentRoot, input.id);
  const tempDir = path.join(contentRoot, `.${input.id}.scaffold-${randomBytes(6).toString("hex")}`);

  try {
    await cp(sourceDir, tempDir, { recursive: true, errorOnExist: true });
  } catch (error) {
    throw new VersionScaffoldError(
      "failed to copy source content directory",
      { sourceVersionId: input.sourceVersionId, newVersionId: input.id },
      error,
    );
  }

  let registryWritten = false;
  try {
    const regionBody = renderVersionsRegion(proposed);
    const nextSource = replaceVersionsRegion(originalSource, regionBody, registryFilePath);
    await writeFile(registryFilePath, nextSource, "utf-8");
    registryWritten = true;

    await rename(tempDir, finalDir);
  } catch (error) {
    if (registryWritten) {
      await writeFile(registryFilePath, originalSource, "utf-8").catch(() => undefined);
    }
    await removeTempDirectory(tempDir);

    if (error instanceof VersionRegistryWriteError) {
      throw error;
    }
    throw new VersionScaffoldError(
      "failed to scaffold new version; the registry and content directory were rolled back",
      { sourceVersionId: input.sourceVersionId, newVersionId: input.id },
      error,
    );
  }

  return { versions: proposed };
}

async function readRegistryFile(registryFilePath: string): Promise<string> {
  try {
    return await readFile(registryFilePath, "utf-8");
  } catch (error) {
    throw new VersionRegistryWriteError(
      `failed to read ${registryFilePath}`,
      { filePath: registryFilePath },
      error,
    );
  }
}
