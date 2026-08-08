import { ImageResponse } from "next/og";

import { siteConfig } from "@/config/site";
import { seoConfig } from "@/config/seo";

export const alt = siteConfig.name;
export const size = { width: seoConfig.defaultOgImage.width, height: seoConfig.defaultOgImage.height };
export const contentType = "image/png";

/**
 * Site-wide default Open Graph image, used by any page that doesn't supply
 * a more specific one (e.g. `app/docs/[...slug]/opengraph-image.tsx`).
 * Renders with `next/og`'s built-in `ImageResponse` and the default system
 * font stack only - fetching a font file over the network at build time
 * would make the build depend on an external service for something purely
 * cosmetic.
 */
export default function Image() {
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
            gap: "12px",
            color: "#a8a29e",
            fontSize: 28,
            letterSpacing: "0.05em",
            textTransform: "uppercase",
          }}
        >
          {siteConfig.name}
        </div>
        <div
          style={{
            display: "flex",
            marginTop: "28px",
            color: "#fafaf9",
            fontSize: 68,
            fontWeight: 700,
            lineHeight: 1.1,
            maxWidth: "900px",
          }}
        >
          {siteConfig.description}
        </div>
      </div>
    ),
    { ...size },
  );
}
