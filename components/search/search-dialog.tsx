"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Alert02Icon,
  CornerDownLeftIcon,
  FileSearchIcon,
  Time04Icon,
} from "@hugeicons/core-free-icons";

import { Button } from "@/components/ui/button";
import {
  Command,
  CommandDialog,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { Kbd, KbdGroup } from "@/components/ui/kbd";
import { Spinner } from "@/components/ui/spinner";
import { SearchResultItem } from "@/components/search/search-result-item";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useRecentSearches } from "@/hooks/use-recent-searches";
import { createSearchEngine, loadSearchIndex, tokenize } from "@/lib/search";
import type { SearchEngine, SearchIndex, SearchResult, SearchSuggestion } from "@/lib/search/types";

type EngineStatus = "idle" | "loading" | "ready" | "error";

interface LoadedSearch {
  index: SearchIndex;
  engine: SearchEngine;
}

const MIN_QUERY_LENGTH = 2;
const CURATED_SLUGS = ["introduction", "installation", "quick-start", "api-reference"];

function buildCuratedSuggestions(index: SearchIndex): SearchSuggestion[] {
  const suggestions: SearchSuggestion[] = [];
  for (const slug of CURATED_SLUGS) {
    const section = index.sections.find((s) => s.docSlug === slug);
    if (section !== undefined) {
      suggestions.push({ label: section.docTitle, href: section.route, reason: "popular" });
    }
  }
  return suggestions;
}

function buildAutocompleteHints(results: readonly SearchResult[], query: string): string[] {
  const trimmedLower = query.trim().toLowerCase();
  const seen = new Set<string>();
  const hints: string[] = [];

  for (const result of results) {
    const candidate = result.section.headingText ?? result.section.docTitle;
    const lower = candidate.toLowerCase();
    if (lower === trimmedLower || seen.has(lower)) {
      continue;
    }
    seen.add(lower);
    hints.push(candidate);
    if (hints.length >= 3) {
      break;
    }
  }

  return hints;
}

function groupResultsByDocument(results: readonly SearchResult[]): [string, SearchResult[]][] {
  const order: string[] = [];
  const groups = new Map<string, SearchResult[]>();

  for (const result of results) {
    const key = result.section.docSlug;
    const existing = groups.get(key);
    if (existing === undefined) {
      groups.set(key, [result]);
      order.push(key);
    } else {
      existing.push(result);
    }
  }

  return order.map((key): [string, SearchResult[]] => [key, groups.get(key) ?? []]);
}

export interface SearchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * The `⌘K` search palette. A single component owns the whole state
 * machine - index loading, debounced querying, and every empty/error
 * state - since D4/D5 push all the interesting logic into `lib/search`
 * and leave this component to sequence calls into it.
 *
 * `shouldFilter={false}` on the inner `Command` root is load-bearing
 * (T2): our own scorer has already ranked and ordered `results`, and
 * leaving cmdk's default fuzzy filter enabled would re-filter (and
 * silently drop) items it disagrees with. For the same reason there is no
 * `CommandEmpty` anywhere in this file (T1) - with `shouldFilter={false}`,
 * `CommandEmpty` only ever renders when literally zero items are mounted,
 * which is exactly the moment recent searches and suggestions need to
 * show instead. The empty/no-results UI here is entirely our own.
 */
export function SearchDialog({ open, onOpenChange }: SearchDialogProps) {
  const router = useRouter();
  const { recent, add: addRecentSearch, clear: clearRecentSearches } = useRecentSearches();

  // `result` is `null` until a load finishes: `undefined` would also work
  // but a distinct sentinel makes "never attempted" vs "attempted, no
  // engine yet" unambiguous. `status` is entirely derived from it rather
  // than tracked as its own state, specifically so this component never
  // needs to call setState synchronously inside the load effect below -
  // only inside the (necessarily async) fetch's `.then`/`.catch`.
  const [result, setResult] = useState<LoadedSearch | "error" | null>(null);
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebouncedValue(query, 120);

  const status: EngineStatus =
    result === null ? (open ? "loading" : "idle") : result === "error" ? "error" : "ready";
  const index = result !== null && result !== "error" ? result.index : null;
  const engine = result !== null && result !== "error" ? result.engine : null;

  // Loads once on first open; a load only ever starts while `result` is
  // still `null`, and a successful load replaces it permanently, so
  // reopening the dialog never refetches. Retrying after an error resets
  // `result` back to `null` (see `retry` below), which is what lets this
  // same effect run again.
  useEffect(() => {
    if (!open || result !== null) {
      return;
    }
    let cancelled = false;

    loadSearchIndex()
      .then((loadedIndex) => {
        if (!cancelled) {
          setResult({ index: loadedIndex, engine: createSearchEngine(loadedIndex) });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setResult("error");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [open, result]);

  const retry = useCallback(() => setResult(null), []);

  function handleOpenChange(next: boolean): void {
    onOpenChange(next);
    if (!next) {
      setQuery("");
    }
  }

  const trimmedQuery = query.trim();
  const isSearchable = debouncedQuery.trim().length >= MIN_QUERY_LENGTH;

  const results = useMemo(() => {
    if (engine === null || !isSearchable) {
      return [];
    }
    return engine.search(debouncedQuery);
  }, [engine, debouncedQuery, isSearchable]);

  const relatedResults = useMemo(() => {
    if (engine === null || results.length > 0 || !isSearchable) {
      return [];
    }
    const [firstToken] = tokenize(debouncedQuery);
    if (firstToken === undefined) {
      return [];
    }
    return engine.search(firstToken, { limit: 4 });
  }, [engine, results, isSearchable, debouncedQuery]);

  const autocompleteHints = useMemo(() => buildAutocompleteHints(results, debouncedQuery), [results, debouncedQuery]);

  const curatedSuggestions = useMemo(() => (index !== null ? buildCuratedSuggestions(index) : []), [index]);

  function goTo(href: string): void {
    handleOpenChange(false);
    router.push(href);
  }

  function handleSelectResult(result: SearchResult): void {
    if (trimmedQuery.length >= MIN_QUERY_LENGTH) {
      addRecentSearch(trimmedQuery);
    }
    goTo(result.section.href);
  }

  function handleSelectRecent(term: string): void {
    setQuery(term);
  }

  function handleSelectHint(hint: string): void {
    setQuery(hint);
  }

  function handleSelectSuggestion(suggestion: SearchSuggestion): void {
    goTo(suggestion.href);
  }

  const groupedResults = groupResultsByDocument(results);
  const showEmptyQueryState = status === "ready" && trimmedQuery.length === 0;
  const showResults = status === "ready" && isSearchable && results.length > 0;
  const showNoResults = status === "ready" && isSearchable && results.length === 0;

  return (
    <CommandDialog
      open={open}
      onOpenChange={handleOpenChange}
      title="Search documentation"
      description="Search across every Aniki SDK documentation page"
    >
      <Command shouldFilter={false} className="max-h-[70vh]">
        <CommandInput
          value={query}
          onValueChange={setQuery}
          placeholder="Search documentation…"
          aria-label="Search documentation"
        />

        <span role="status" aria-live="polite" className="sr-only">
          {status === "loading" && "Loading search index…"}
          {status === "error" && "Search index failed to load."}
          {showResults && `${results.length} result${results.length === 1 ? "" : "s"} found.`}
          {showNoResults && `No results for ${trimmedQuery}.`}
        </span>

        {status === "ready" && autocompleteHints.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 border-b border-border/50 px-3 py-2">
            {autocompleteHints.map((hint) => (
              <button
                key={hint}
                type="button"
                onClick={() => handleSelectHint(hint)}
                className="rounded-full border border-border bg-muted/50 px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                {hint}
              </button>
            ))}
          </div>
        )}

        <CommandList>
          {status === "loading" && (
            <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
              <Spinner className="size-4" />
              Loading search index…
            </div>
          )}

          {status === "error" && (
            <div className="flex flex-col items-center gap-3 py-10 text-center">
              <HugeiconsIcon icon={Alert02Icon} strokeWidth={2} className="size-6 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Couldn&apos;t load the search index.</p>
              <Button type="button" variant="outline" size="sm" onClick={retry}>
                Retry
              </Button>
            </div>
          )}

          {showEmptyQueryState && (
            <>
              {recent.length > 0 && (
                <CommandGroup heading="Recent searches">
                  {recent.map((term) => (
                    <CommandItem key={`recent:${term}`} value={`recent:${term}`} onSelect={() => handleSelectRecent(term)}>
                      <HugeiconsIcon icon={Time04Icon} strokeWidth={2} className="size-4 text-muted-foreground" />
                      <span className="truncate">{term}</span>
                    </CommandItem>
                  ))}
                  <CommandItem
                    value="recent:clear-all"
                    onSelect={() => clearRecentSearches()}
                    className="text-muted-foreground"
                  >
                    Clear recent searches
                  </CommandItem>
                </CommandGroup>
              )}

              {recent.length > 0 && curatedSuggestions.length > 0 && <CommandSeparator />}

              {curatedSuggestions.length > 0 && (
                <CommandGroup heading="Suggestions">
                  {curatedSuggestions.map((suggestion) => (
                    <CommandItem
                      key={`suggestion:${suggestion.href}`}
                      value={`suggestion:${suggestion.href}`}
                      onSelect={() => handleSelectSuggestion(suggestion)}
                    >
                      {suggestion.label}
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
            </>
          )}

          {showResults &&
            groupedResults.map(([docSlug, docResults]) => (
              <CommandGroup key={docSlug} heading={docResults[0]?.section.docTitle ?? docSlug}>
                {docResults.map((result) => (
                  <CommandItem
                    key={result.section.id}
                    value={result.section.id}
                    onSelect={() => handleSelectResult(result)}
                  >
                    <SearchResultItem result={result} />
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}

          {showNoResults && (
            <div className="flex flex-col gap-4 px-3 py-6">
              <div className="flex flex-col items-center gap-2 text-center">
                <HugeiconsIcon icon={FileSearchIcon} strokeWidth={2} className="size-6 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">No results for &quot;{trimmedQuery}&quot;</p>
              </div>

              {relatedResults.length > 0 && (
                <CommandGroup heading="Related">
                  {relatedResults.map((result) => (
                    <CommandItem
                      key={result.section.id}
                      value={result.section.id}
                      onSelect={() => handleSelectResult(result)}
                    >
                      <SearchResultItem result={result} />
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}

              {curatedSuggestions.length > 0 && (
                <CommandGroup heading="Suggestions">
                  {curatedSuggestions.map((suggestion) => (
                    <CommandItem
                      key={`suggestion:${suggestion.href}`}
                      value={`suggestion:${suggestion.href}`}
                      onSelect={() => handleSelectSuggestion(suggestion)}
                    >
                      {suggestion.label}
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}

              <CommandItem value="browse-all-docs" onSelect={() => goTo("/docs")}>
                Browse all documentation
              </CommandItem>
            </div>
          )}
        </CommandList>

        <div className="hidden items-center justify-between gap-4 border-t border-border/50 px-3 py-2 text-xs text-muted-foreground sm:flex">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <KbdGroup>
                <Kbd>↑</Kbd>
                <Kbd>↓</Kbd>
              </KbdGroup>
              Navigate
            </span>
            <span className="flex items-center gap-1">
              <Kbd>
                <HugeiconsIcon icon={CornerDownLeftIcon} strokeWidth={2} />
              </Kbd>
              Open
            </span>
            <span className="flex items-center gap-1">
              <Kbd>esc</Kbd>
              Close
            </span>
          </div>
        </div>
      </Command>
    </CommandDialog>
  );
}
