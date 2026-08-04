"use client";

import { createContext, useCallback, useContext, useState } from "react";
import { useRouter, usePathname } from "next/navigation";

import { ShortcutsDialog } from "@/components/docs/shortcuts-dialog";
import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts";
import { findAdjacentByRoute } from "@/lib/navigation/adjacent";
import type { DocNavCategory } from "@/lib/content/types";

/**
 * The overlay state and controls `useNavigationUi` exposes to the rest of
 * the tree - currently just the shortcuts help dialog. The command palette
 * extends this with `paletteOpen`/`openPalette`/`closePalette`.
 */
interface NavigationUiContextValue {
  helpOpen: boolean;
  openHelp: () => void;
  closeHelp: () => void;
}

const NavigationUiContext = createContext<NavigationUiContextValue | null>(null);

/**
 * Reads the shared navigation overlay state installed by `NavigationProvider`.
 * Throws when called outside it rather than returning a silent default,
 * since a header button calling `openHelp()` with no provider mounted is a
 * wiring bug worth surfacing immediately, not a state to design around.
 */
export function useNavigationUi(): NavigationUiContextValue {
  const context = useContext(NavigationUiContext);
  if (context === null) {
    throw new Error("useNavigationUi must be used within a NavigationProvider");
  }
  return context;
}

/**
 * Owns every piece of overlay state the keyboard-shortcut layer touches,
 * mounted once in the root layout (see D11 in the Step 5 spec) so there is
 * exactly one global `keydown` listener and one source of truth for "is an
 * overlay open" - rather than each overlay installing its own listener and
 * the two racing to decide who handles a given key.
 *
 * `previous-page`/`next-page` derive the adjacent document from `nav` (the
 * same tree the sidebar renders) and the current pathname via
 * `findAdjacentByRoute`, since a layout-level provider has no access to a
 * page's server-fetched `adjacent` prop. Both are suspended while the help
 * dialog is open, so `[`/`]` typed to read the shortcut list don't also
 * navigate away from the page displaying it.
 */
export function NavigationProvider({
  nav,
  children,
}: {
  nav: DocNavCategory[];
  children: React.ReactNode;
}) {
  const [helpOpen, setHelpOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  const openHelp = useCallback(() => setHelpOpen(true), []);
  const closeHelp = useCallback(() => setHelpOpen(false), []);

  useKeyboardShortcuts(
    {
      "previous-page": () => {
        if (helpOpen) {
          return;
        }
        const { previous } = findAdjacentByRoute(nav, pathname);
        if (previous !== null) {
          router.push(previous.route);
        }
      },
      "next-page": () => {
        if (helpOpen) {
          return;
        }
        const { next } = findAdjacentByRoute(nav, pathname);
        if (next !== null) {
          router.push(next.route);
        }
      },
      "toggle-help": () => setHelpOpen((previous) => !previous),
    },
    true,
  );

  return (
    <NavigationUiContext.Provider value={{ helpOpen, openHelp, closeHelp }}>
      {children}
      <ShortcutsDialog open={helpOpen} onOpenChange={setHelpOpen} />
    </NavigationUiContext.Provider>
  );
}
