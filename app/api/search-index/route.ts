import { buildSearchIndex } from "@/lib/search/indexer";

/**
 * Serves the search index as a prerendered static JSON route (D4).
 *
 * Passing the index through the root layout as props would add hundreds
 * of KB of RSC payload to every page load, including the landing page,
 * which never opens the search palette. Serving it from a dedicated
 * static route means the cost is paid once, lazily, the first time a user
 * opens `⌘K` - and served from the CDN thereafter since `force-static`
 * makes this route build-time-only, with no per-request work.
 */
export const dynamic = "force-static";

export async function GET(): Promise<Response> {
  const index = await buildSearchIndex();
  return Response.json(index, {
    headers: {
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
