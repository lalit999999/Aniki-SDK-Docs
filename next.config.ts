import type { NextConfig } from "next";

import { getLatestVersion } from "./lib/versions/registry";

/**
 * D6: the latest documentation version's prefixed URLs
 * (`/docs/<latest>`, `/docs/<latest>/:slug`) redirect to their unprefixed
 * canonical form rather than being emitted as a second static path
 * (`generateStaticParams` in `app/docs/[...slug]/page.tsx` deliberately
 * never produces them - see `getAllVersionedRoutes`). This keeps exactly
 * one canonical URL per page and lets old `/docs/v1/*`-style bookmarks
 * keep working forever once a newer version takes over the unprefixed
 * URLs.
 */
const nextConfig: NextConfig = {
  reactCompiler: true,
  transpilePackages: ["@hugeicons/react", "@hugeicons/core-free-icons"],
  async redirects() {
    const latestId = getLatestVersion().id;
    return [
      {
        source: `/docs/${latestId}`,
        destination: "/docs",
        permanent: true,
      },
      {
        source: `/docs/${latestId}/:slug`,
        destination: "/docs/:slug",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
