/**
 * Site-wide configuration: name, description, canonical URL, and the
 * external links the header/footer render. The single source of truth so
 * no component hardcodes a repo URL or nav label directly.
 */

export interface SiteNavLink {
  /** Visible label. */
  label: string;
  /** Path or absolute URL. */
  href: string;
  /** Set for links that leave the site, so consumers can add
   * `target="_blank"` and the external-link affordance. */
  external?: boolean;
}

export interface SiteConfig {
  name: string;
  description: string;
  /** Canonical site origin, used for absolute URLs in metadata/sitemap. */
  url: string;
  /** SDK package name shown in the install command. */
  packageName: string;
  links: {
    /** Documentation source repository (this site). */
    docsRepo: string;
    /** The Aniki SDK repository itself. */
    sdkRepo: string;
  };
  /** Primary navigation rendered in the header. */
  primaryNav: SiteNavLink[];
}

/**
 * The site's static configuration. `url` reads `NEXT_PUBLIC_SITE_URL` so
 * production deploys can override it without a code change, falling back
 * to localhost for development.
 */
export const siteConfig: SiteConfig = {
  name: "Aniki SDK",
  description:
    "Documentation for Aniki SDK, a provider-agnostic TypeScript SDK for building production-ready AI agents.",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
  packageName: "aniki-sdk",
  links: {
    docsRepo: "https://github.com/lalit999999/Aniki-SDK-Docs",
    sdkRepo: "https://github.com/lalit999999/Aniki-SDK",
  },
  primaryNav: [{ label: "Docs", href: "/docs" }],
};
