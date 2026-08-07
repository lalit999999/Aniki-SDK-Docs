import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths()],
  resolve: {
    alias: {
      // `lib/search/indexer.ts` (and `lib/content/index.ts`) start with
      // `import "server-only"`, which resolves to a module that throws
      // unless bundled under Next's "react-server" export condition.
      // Applying that condition to Vitest's *whole* SSR module graph (as a
      // previous version of this config did) would let those imports
      // through, but it also makes every other package - `react` included
      // - resolve its "react-server" build instead of the default one,
      // which has no `useLayoutEffect` export: any test that transitively
      // imports a Radix-based `components/ui/*` primitive (as
      // `tests/doc-components/registry.test.ts` now does, via the `tabs`
      // family in the registry) would fail to import `react` at all.
      // Aliasing this one package straight to its own "react-server" build
      // gets the same no-op behaviour with none of that collateral damage.
      "server-only": fileURLToPath(new URL("./node_modules/server-only/empty.js", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
});
