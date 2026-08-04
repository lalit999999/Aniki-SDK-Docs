import Link from "next/link";
import { HugeiconsIcon } from "@hugeicons/react";
import { GithubIcon, Search01Icon } from "@hugeicons/core-free-icons";

import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { HeaderShell } from "@/components/docs/header-shell";
import { MobileSidebar } from "@/components/docs/mobile-sidebar";
import { ThemeToggle } from "@/components/docs/theme-toggle";
import { siteConfig } from "@/config/site";
import type { DocNavCategory } from "@/lib/content";

/**
 * The site-wide header: sticky, transparent at the top of the page and
 * blurred once scrolled (`HeaderShell`), with the logo, primary nav, a
 * disabled search placeholder, GitHub link, theme toggle, and - on small
 * viewports - the documentation drawer trigger. Stays a Server Component;
 * only the pieces that need the browser (`HeaderShell`, `MobileSidebar`,
 * `ThemeToggle`) are client leaves.
 */
export function DocsHeader({ nav }: { nav: DocNavCategory[] }) {
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

        <div className="ml-auto flex items-center gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" aria-disabled aria-label="Search (coming soon)" disabled>
                <HugeiconsIcon icon={Search01Icon} strokeWidth={2} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Coming soon</TooltipContent>
          </Tooltip>

          <Button asChild variant="ghost" size="icon" aria-label="View on GitHub">
            <a href={siteConfig.links.sdkRepo} target="_blank" rel="noreferrer noopener">
              <HugeiconsIcon icon={GithubIcon} strokeWidth={2} />
            </a>
          </Button>

          <ThemeToggle />

          <MobileSidebar nav={nav} />
        </div>
      </div>
    </HeaderShell>
  );
}
