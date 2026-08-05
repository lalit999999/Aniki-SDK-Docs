import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths()],
  // `lib/search/indexer.ts` (and `lib/content/index.ts`) start with
  // `import "server-only"`, which resolves to a module that throws unless
  // bundled under Next's "react-server" export condition. Applying that
  // condition to Vitest's SSR module graph lets tests import those modules
  // directly instead of every server-only file needing a parallel
  // non-guarded twin just to be testable.
  ssr: { resolve: { conditions: ["react-server"] } },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
});
