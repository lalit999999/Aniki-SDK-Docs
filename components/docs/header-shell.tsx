"use client";

import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";

/**
 * The only part of the header that needs the browser: a scroll listener
 * that swaps a transparent background for a blurred, bordered one once the
 * page has scrolled past a few pixels. Everything else in the header stays
 * server-rendered and is passed through as `children`.
 */
export function HeaderShell({ children }: { children: React.ReactNode }) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    function onScroll() {
      setScrolled(window.scrollY > 8);
    }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={cn(
        "sticky top-0 z-50 h-[var(--header-height)] w-full transition-[background-color,border-color,backdrop-filter] duration-300",
        scrolled
          ? "border-b border-border bg-background/80 supports-backdrop-filter:backdrop-blur-md"
          : "border-b border-transparent bg-transparent",
      )}
    >
      {children}
    </header>
  );
}
