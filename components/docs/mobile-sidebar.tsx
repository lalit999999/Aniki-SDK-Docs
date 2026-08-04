"use client";

import { useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Menu01Icon } from "@hugeicons/core-free-icons";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { DocsSidebarNav } from "@/components/docs/docs-sidebar-nav";
import type { DocNavCategory } from "@/lib/content";

/**
 * The documentation nav as a slide-over drawer, for viewports below
 * `lg` where the persistent sidebar (`DocsSidebar`) is hidden. Closes on
 * navigation; Radix's `Dialog` primitive underlying `Sheet` returns focus
 * to the trigger on close and traps focus while open.
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
          <DocsSidebarNav nav={nav} onNavigate={() => setOpen(false)} />
        </div>
      </SheetContent>
    </Sheet>
  );
}
