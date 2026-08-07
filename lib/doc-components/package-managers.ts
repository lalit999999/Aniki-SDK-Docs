/**
 * Pure package-manager install-command construction and preference
 * persistence for `::package-install`.
 *
 * `buildInstallCommand` is the highest-value pure function in this part of
 * the component library: the four supported managers don't just differ in
 * their invocation name, they differ in which flags exist at all. npm,
 * pnpm, and yarn all accept `-D` for a dev dependency; bun's short flag is
 * lowercase `-d`. npm and pnpm add a global package with `-g` on the same
 * `install`/`add` verb; yarn classic has no such flag on `add` at all and
 * requires the separate `yarn global add` subcommand. A one-off run
 * (`exec`) isn't an install in any manager and uses yet another command
 * per manager (`npx`, `pnpm dlx`, `yarn dlx`, `bunx`). Getting any one of
 * these wrong by hand is exactly the kind of mistake this function exists
 * to make impossible.
 *
 * Storage helpers here follow `lib/search/recent-searches.ts` exactly
 * (D12): pure functions over an explicit `Storage`, every access
 * try/caught, every failure degrading to a default rather than throwing.
 */

/** The four package managers `::package-install` supports. */
export const PACKAGE_MANAGERS = ["npm", "pnpm", "yarn", "bun"] as const;
export type PackageManager = (typeof PACKAGE_MANAGERS)[number];

export interface BuildInstallCommandOptions {
  manager: PackageManager;
  /** One or more package names/specifiers, already split from the
   * directive's `name` attribute. */
  packages: readonly string[];
  /** Install as a dev dependency. Ignored when `exec` is set (a one-off
   * run is never "installed" at all) and when `global` is set (global
   * packages have no dev/production distinction). */
  dev?: boolean;
  /** Install globally, using each manager's actual global syntax rather
   * than assuming `-g` works everywhere - yarn classic doesn't accept it
   * on `add` and needs the `global add` subcommand instead. Takes
   * precedence over `dev` when both are set. */
  global?: boolean;
  /** Run the package(s) as a one-off instead of installing them
   * (`npx`/`pnpm dlx`/`yarn dlx`/`bunx`). Takes precedence over both `dev`
   * and `global`. */
  exec?: boolean;
}

export interface BuildInstallCommandOk {
  ok: true;
  command: string;
}

export interface BuildInstallCommandFail {
  ok: false;
  issue: string;
}

export type BuildInstallCommandResult = BuildInstallCommandOk | BuildInstallCommandFail;

const EXEC_COMMAND: Record<PackageManager, string> = {
  npm: "npx",
  pnpm: "pnpm dlx",
  yarn: "yarn dlx",
  bun: "bunx",
};

const INSTALL_VERB: Record<PackageManager, string> = {
  npm: "install",
  pnpm: "add",
  yarn: "add",
  bun: "add",
};

/** Short dev-dependency flag. Every manager but bun uses uppercase `-D`;
 * bun's own CLI help documents the lowercase `-d` short form instead. */
const DEV_FLAG: Record<PackageManager, string> = {
  npm: "-D",
  pnpm: "-D",
  yarn: "-D",
  bun: "-d",
};

/** Full global-install command per manager - not just a flag, since
 * yarn classic has no `-g` on `add` at all and needs a different
 * subcommand entirely. */
function globalCommand(manager: PackageManager, names: string): string {
  if (manager === "yarn") {
    return `yarn global add ${names}`;
  }
  return `${manager} ${INSTALL_VERB[manager]} -g ${names}`;
}

/**
 * Builds the exact install command for one package manager. Never throws
 * (matching this bridge's D5 "never crash" ethos, extended to its pure
 * helpers): an empty `packages` list - authoring `::package-install{name=""}`,
 * or a `name` that splits to nothing - reports an issue instead of
 * quietly producing a bare `npm install` that installs whatever
 * `package.json` already lists, which is a different, misleading command.
 *
 * @example
 * ```ts
 * buildInstallCommand({ manager: "npm", packages: ["aniki-sdk"] });
 * // { ok: true, command: "npm install aniki-sdk" }
 * buildInstallCommand({ manager: "yarn", packages: ["aniki-sdk"], global: true });
 * // { ok: true, command: "yarn global add aniki-sdk" }
 * buildInstallCommand({ manager: "bun", packages: ["aniki-sdk"], dev: true });
 * // { ok: true, command: "bun add -d aniki-sdk" }
 * buildInstallCommand({ manager: "pnpm", packages: ["create-next-app"], exec: true });
 * // { ok: true, command: "pnpm dlx create-next-app" }
 * ```
 */
export function buildInstallCommand(options: BuildInstallCommandOptions): BuildInstallCommandResult {
  const { manager, packages, dev = false, global = false, exec = false } = options;

  if (packages.length === 0) {
    return { ok: false, issue: "at least one package name is required" };
  }
  const names = packages.join(" ");

  if (exec) {
    return { ok: true, command: `${EXEC_COMMAND[manager]} ${names}` };
  }
  if (global) {
    return { ok: true, command: globalCommand(manager, names) };
  }
  const flag = dev ? ` ${DEV_FLAG[manager]}` : "";
  return { ok: true, command: `${manager} ${INSTALL_VERB[manager]}${flag} ${names}` };
}

/** Versioned so a future change to the stored shape can be detected and
 * the old value discarded instead of misread - see `RECENT_SEARCHES_KEY`. */
export const PACKAGE_MANAGER_STORAGE_KEY = "aniki-docs:package-manager:v1";

function isPackageManager(value: unknown): value is PackageManager {
  return typeof value === "string" && (PACKAGE_MANAGERS as readonly string[]).includes(value);
}

/**
 * Reads the stored package-manager preference. Returns `null` for a
 * missing key, a corrupted/unrecognized value, or a `storage` that throws
 * (private browsing, disabled storage) - every failure mode collapses to
 * "no preference" rather than propagating.
 */
export function readPackageManagerPreference(storage: Storage): PackageManager | null {
  try {
    const raw = storage.getItem(PACKAGE_MANAGER_STORAGE_KEY);
    return isPackageManager(raw) ? raw : null;
  } catch {
    return null;
  }
}

/** Persists `manager`. A quota-exceeded or unavailable `storage` silently
 * drops the write rather than throwing. */
export function writePackageManagerPreference(storage: Storage, manager: PackageManager): void {
  try {
    storage.setItem(PACKAGE_MANAGER_STORAGE_KEY, manager);
  } catch {
    // Storage unavailable or full - the write is lost, not fatal.
  }
}
