/**
 * Public, client-safe entry point for `lib/admin`.
 *
 * Deliberately does not re-export everything in this directory.
 * `config.ts`, `credentials.ts`, `session.ts`, and `rate-limit.ts` all sit
 * behind Node-only or request-scoped APIs (`node:crypto`, `next/headers`'s
 * `cookies()`) - folding them into the same barrel as `types.ts` and
 * `nav.ts` would mean a single `import ... from "@/lib/admin"` inside a
 * Client Component (`admin-sidebar.tsx`, `admin-topbar.tsx`) could
 * transitively pull in server-only code and fail to bundle. Server-side
 * code (every route handler and Server Component in this branch) imports
 * those modules directly by path instead: `@/lib/admin/session`,
 * `@/lib/admin/config`, `@/lib/admin/credentials`, `@/lib/admin/rate-limit`.
 *
 * This barrel exists so anything that only needs navigation data or
 * shared types - which does include Client Components - has one stable,
 * obviously-safe import.
 *
 * @example
 * ```ts
 * import { ADMIN_NAV } from "@/lib/admin";
 * import type { AdminSession } from "@/lib/admin";
 * ```
 */

export { ADMIN_NAV } from "./nav";
export type { AdminNavItem } from "./nav";

export type { AdminAuthResult, AdminConfig, AdminSession, AdminSessionPayload } from "./types";
