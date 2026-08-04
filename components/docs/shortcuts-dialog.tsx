"use client";

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Kbd } from "@/components/ui/kbd";
import { SHORTCUTS } from "@/lib/navigation/shortcuts";

/**
 * The keyboard shortcut reference, opened with `?` or from wherever the
 * header exposes it. Rendered entirely from `SHORTCUTS` - the single
 * source of truth `matchShortcut` also reads from - so this list can never
 * drift out of sync with what actually fires. `Dialog`/`DialogContent`
 * already render an accessible title/description and trap and restore
 * focus; nothing extra is needed here for that.
 */
export function ShortcutsDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Keyboard shortcuts</DialogTitle>
          <DialogDescription>Navigate the documentation without leaving the keyboard.</DialogDescription>
        </DialogHeader>
        <ul className="flex flex-col gap-3 text-sm">
          {SHORTCUTS.map((shortcut) => (
            <li key={shortcut.action} className="flex items-center justify-between gap-4">
              <span className="text-muted-foreground">{shortcut.label}</span>
              <span className="flex items-center gap-1">
                {shortcut.keys.map((key) => (
                  <Kbd key={key}>{key}</Kbd>
                ))}
              </span>
            </li>
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  );
}
