"use client";

import { useState } from "react";
import Link from "next/link";
import { HugeiconsIcon } from "@hugeicons/react";
import { Menu01Icon } from "@hugeicons/core-free-icons";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { DocsSidebarNav } from "@/components/docs/docs-sidebar-nav";
import { siteConfig } from "@/config/site";
import type { DocNavCategory } from "@/lib/content";

/**
 * The documentation nav as a slide-over drawer, for viewports below
 * `lg` where the persistent sidebar (`DocsSidebar`) is hidden. This is also
 * the only path to primary navigation (`siteConfig.primaryNav`, otherwise
 * `hidden sm:flex` in the header) below `sm`, so it renders those links
 * above the doc nav rather than doc nav alone. Closes on navigation;
 * Radix's `Dialog` primitive underlying `Sheet` returns focus to the
 * trigger on close and traps focus while open.
 */
export function MobileSidebar({ nav }: { nav: DocNavCategory[] }) {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open documentation menu">
          <HugeiconsIcon icon={Menu01Icon} strokeWidth={2} />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-4/5 overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Documentation</SheetTitle>
        </SheetHeader>
        <div className="px-4 pb-8">
          <nav aria-label="Primary" className="mb-4 flex flex-col gap-0.5 text-sm">
            {siteConfig.primaryNav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                target={item.external ? "_blank" : undefined}
                rel={item.external ? "noreferrer noopener" : undefined}
                onClick={() => setOpen(false)}
                className="rounded-md px-3 py-1.5 font-medium text-foreground transition-colors outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/30"
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <Separator className="mb-4" />
          <DocsSidebarNav nav={nav} onNavigate={() => setOpen(false)} />
        </div>
      </SheetContent>
    </Sheet>
  );
}
