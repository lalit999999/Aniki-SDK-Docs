import { ImageResponse } from "next/og";

import { seoConfig } from "@/config/seo";
import { siteConfig } from "@/config/site";
import { findDocBySlug, getAllVersionedRoutes } from "@/lib/content";
import { getVersionById } from "@/lib/versions";
import { resolveDocsPath } from "@/lib/versions/route";

const size = { width: seoConfig.defaultOgImage.width, height: seoConfig.defaultOgImage.height };

/**
 * Per-page Open Graph image for a documentation page.
 *
 * This lives outside `app/docs/[...slug]/` rather than as that segment's
 * `opengraph-image.tsx` convention file: Next.js requires a catch-all
 * segment to be the last part of a route ("Catch-all must be the last
 * part of the URL"), and the `opengraph-image` convention appends a
 * literal segment after whichever segment it's colocated with. Colocating
 * it inside `[...slug]` therefore fails the build outright - there is no
 * way to nest a static-suffixed convention file inside a catch-all route.
 * Putting the catch-all last here (`opengraph-image/[...slug]`) is the
 * only routing shape Next.js accepts, so the image is wired in manually
 * via `imageUrl` in `buildPageMetadata` calls rather than picked up by the
 * automatic file-convention `<meta property="og:image">` injection.
 *
 * Mirrors the page's own `generateStaticParams` (`getAllVersionedRoutes`)
 * so this stays statically generated rather than falling back to
 * per-request rendering.
 */
export async function generateStaticParams() {
  const routes = await getAllVersionedRoutes();
  return routes.filter((route) => route.segments.length > 0).map((route) => ({ slug: route.segments }));
}

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string[] }> }) {
  const { slug } = await params;
  const resolved = resolveDocsPath(slug);

  let title = siteConfig.name;
  let badge = "Docs";

  if (resolved !== null) {
    const { versionId, docSlug } = resolved;
    const doc = await findDocBySlug(docSlug ?? "index", versionId);
    if (doc !== null) {
      title = doc.meta.title;
      const version = getVersionById(versionId);
      badge = doc.meta.isLatestVersion ? doc.meta.category : `${doc.meta.category} · ${version.label}`;
    }
  }

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "flex-start",
          padding: "80px",
          backgroundColor: "#0c0a09",
          backgroundImage: "linear-gradient(135deg, #0c0a09 0%, #1c1917 100%)",
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            color: "#0c0a09",
            backgroundColor: "#f59e0b",
            fontSize: 24,
            fontWeight: 600,
            padding: "8px 20px",
            borderRadius: "999px",
          }}
        >
          {badge}
        </div>
        <div
          style={{
            display: "flex",
            marginTop: "32px",
            color: "#fafaf9",
            fontSize: 64,
            fontWeight: 700,
            lineHeight: 1.15,
            maxWidth: "920px",
          }}
        >
          {title}
        </div>
        <div
          style={{
            display: "flex",
            marginTop: "40px",
            color: "#a8a29e",
            fontSize: 28,
            letterSpacing: "0.05em",
            textTransform: "uppercase",
          }}
        >
          {siteConfig.name}
        </div>
      </div>
    ),
    { ...size },
  );
}
