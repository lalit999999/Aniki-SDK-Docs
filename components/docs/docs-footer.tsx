import Link from "next/link";

import { siteConfig } from "@/config/site";

const DOCS_VERSION = "v1";

/**
 * Minimal site footer: copyright, GitHub, the current documentation
 * version, license, and community links. All from `siteConfig` - nothing
 * here is a page-specific hardcoded link.
 */
export function DocsFooter() {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-8 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
        <p>
          © {new Date().getFullYear()} {siteConfig.name}. Released under the MIT License.
        </p>
        <nav aria-label="Community" className="flex items-center gap-4">
          <Link href={siteConfig.links.sdkRepo} target="_blank" rel="noreferrer noopener" className="hover:text-foreground">
            GitHub
          </Link>
          <Link href={`${siteConfig.links.sdkRepo}/discussions`} target="_blank" rel="noreferrer noopener" className="hover:text-foreground">
            Discussions
          </Link>
          <Link href={`${siteConfig.links.sdkRepo}/issues`} target="_blank" rel="noreferrer noopener" className="hover:text-foreground">
            Issues
          </Link>
          <span aria-label={`Documentation version ${DOCS_VERSION}`}>{DOCS_VERSION}</span>
        </nav>
      </div>
    </footer>
  );
}
