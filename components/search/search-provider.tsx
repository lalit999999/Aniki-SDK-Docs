"use client";

import { createContext, useCallback, useContext, useState } from "react";

import { SearchDialog } from "@/components/search/search-dialog";
import { useSearchHotkey } from "@/hooks/use-search-hotkey";

interface SearchContextValue {
  open: boolean;
  setOpen: (open: boolean) => void;
  openSearch: () => void;
}

const SearchContext = createContext<SearchContextValue | null>(null);

/**
 * Reads the shared search-palette state installed by `SearchProvider`.
 * Throws when called outside it, matching `useNavigationUi` - a trigger
 * rendered with no provider mounted is a wiring bug worth surfacing
 * immediately, not a state to silently design around.
 */
export function useSearch(): SearchContextValue {
  const context = useContext(SearchContext);
  if (context === null) {
    throw new Error("useSearch must be used within a SearchProvider");
  }
  return context;
}

/**
 * Owns the search palette's open/closed state and the global `⌘K`/`/`
 * hotkey, mounted once in the root layout so the palette is reachable
 * from every page, including the landing page. Renders `SearchDialog`
 * itself so callers only need `<SearchProvider>` plus a `<SearchTrigger>`
 * somewhere in the tree - no separate dialog to remember to mount.
 */
export function SearchProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const openSearch = useCallback(() => setOpen(true), []);

  useSearchHotkey(openSearch, !open);

  return (
    <SearchContext.Provider value={{ open, setOpen, openSearch }}>
      {children}
      <SearchDialog open={open} onOpenChange={setOpen} />
    </SearchContext.Provider>
  );
}
