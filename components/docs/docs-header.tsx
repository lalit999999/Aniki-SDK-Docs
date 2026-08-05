import Link from "next/link";
import { HugeiconsIcon } from "@hugeicons/react";
import { GithubIcon } from "@hugeicons/core-free-icons";

import { Button } from "@/components/ui/button";
import { HeaderShell } from "@/components/docs/header-shell";
import { SearchTrigger } from "@/components/search/search-trigger";
import { ThemeToggle } from "@/components/docs/theme-toggle";
import { VersionSwitcher } from "@/components/docs/version-switcher";
import { siteConfig } from "@/config/site";

/**
 * The site-wide header: sticky, transparent at the top of the page and
 * blurred once scrolled (`HeaderShell`), with the logo, primary nav, the
 * version switcher, the `⌘K` search trigger, GitHub link, and theme toggle.
 * Stays a Server Component; only the pieces that need the browser
 * (`HeaderShell`, `VersionSwitcher`, `SearchTrigger`, `ThemeToggle`) are
 * client leaves.
 *
 * No longer renders the documentation drawer (D12): a root layout has no
 * route params, so it can't supply version-scoped navigation data. The
 * drawer moved into `DocsNavMobile`, rendered by each docs page instead.
 */
export function DocsHeader() {
  return (
    <HeaderShell>
      <div className="mx-auto flex h-full max-w-7xl items-center gap-4 px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-2 font-heading text-sm font-semibold text-foreground">
          <span className="flex size-6 items-center justify-center rounded-md bg-primary text-primary-foreground">
            A
          </span>
          {siteConfig.name}
        </Link>

        <nav aria-label="Primary" className="hidden items-center gap-1 sm:flex">
          {siteConfig.primaryNav.map((item) => (
            <Button key={item.href} asChild variant="ghost" size="sm">
              <Link href={item.href} target={item.external ? "_blank" : undefined} rel={item.external ? "noreferrer noopener" : undefined}>
                {item.label}
              </Link>
            </Button>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <VersionSwitcher />
          <SearchTrigger />

          <Button asChild variant="ghost" size="icon" aria-label="View on GitHub">
            <a href={siteConfig.links.sdkRepo} target="_blank" rel="noreferrer noopener">
              <HugeiconsIcon icon={GithubIcon} strokeWidth={2} />
            </a>
          </Button>

          <ThemeToggle />
        </div>
      </div>
    </HeaderShell>
  );
}
