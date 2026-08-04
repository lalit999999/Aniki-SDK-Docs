"use client";

import { useRouter } from "next/navigation";

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { siteConfig } from "@/config/site";
import { buildPaletteItems } from "@/lib/navigation/palette";
import type { PaletteItem } from "@/lib/navigation/palette";
import type { DocNavCategory } from "@/lib/content/types";

/**
 * The ⌘K navigation palette: every documentation page plus the site's
 * primary nav links, built once per open via `buildPaletteItems`. Filtering
 * and arrow-key/Enter selection are entirely cmdk's own behaviour - this
 * component only supplies the item list and reacts to a selection, it does
 * not reimplement either.
 */
export function NavPalette({
  open,
  onOpenChange,
  nav,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  nav: readonly DocNavCategory[];
}) {
  const router = useRouter();
  const items = buildPaletteItems(nav, siteConfig.primaryNav);
  const groups = groupByGroup(items);

  const handleSelect = (item: PaletteItem) => {
    onOpenChange(false);
    if (item.external) {
      window.open(item.route, "_blank", "noopener,noreferrer");
      return;
    }
    router.push(item.route);
  };

  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Navigation palette"
      description="Jump to any documentation page or primary site link"
    >
      <CommandInput placeholder="Search documentation..." />
      <CommandList>
        <CommandEmpty>No matching page. Try a different search term.</CommandEmpty>
        {groups.map(([group, groupItems]) => (
          <CommandGroup key={group} heading={group}>
            {groupItems.map((item) => (
              <CommandItem
                key={item.id}
                value={`${item.label} ${item.description}`}
                onSelect={() => handleSelect(item)}
              >
                <div className="flex min-w-0 flex-col">
                  <span className="truncate">{item.label}</span>
                  <span className="truncate text-xs text-muted-foreground">{item.description}</span>
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        ))}
      </CommandList>
    </CommandDialog>
  );
}

function groupByGroup(items: readonly PaletteItem[]): [string, PaletteItem[]][] {
  const groups = new Map<string, PaletteItem[]>();
  for (const item of items) {
    const existing = groups.get(item.group);
    if (existing === undefined) {
      groups.set(item.group, [item]);
    } else {
      existing.push(item);
    }
  }
  return Array.from(groups.entries());
}
