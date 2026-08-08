/**
 * The declared list of documentation versions - the one file a human edits
 * to ship a new docs version (D2). Everything else in the versioning system
 * (content directories, routes, redirects, the switcher) is derived from
 * this data and validated against it.
 *
 * This module must stay client-safe: no `server-only`, no `node:*` imports,
 * no `process.cwd()`. It is imported at runtime by the version switcher (a
 * Client Component, T4) and at build time by `next.config.ts` (T5).
 *
 * Entries must be ordered newest-first, and exactly one entry must have
 * `status: "latest"` - both are enforced by `validateVersions()` in
 * `lib/versions/registry.ts`, run once at module load.
 */

import type { DocsVersion } from "@/lib/versions/types";

export const DOCS_VERSIONS: readonly DocsVersion[] = [
  // aniki:versions:start — machine-rewritten by lib/admin/versions/scaffold.ts; hand edits are preserved only if they remain valid DocsVersion literals
  {
    id: "v1",
    label: "v1.0",
    status: "latest",
    releasedAt: "2026-08-03",
    sdkVersion: "0.1.x",
  },
  // aniki:versions:end
];
