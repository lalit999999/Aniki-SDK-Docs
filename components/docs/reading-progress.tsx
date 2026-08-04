"use client";

import { useEffect, useState } from "react";

import { useMediaQuery } from "@/hooks/use-media-query";

function readScrollProgress(): number {
  if (typeof window === "undefined") {
    return 0;
  }
  const scrollable = document.documentElement.scrollHeight - window.innerHeight;
  return scrollable > 0 ? Math.min(100, (window.scrollY / scrollable) * 100) : 0;
}

/**
 * A 2px bar tracking scroll progress through the whole page, mounted just
 * under the header. Disabled under `prefers-reduced-motion: reduce`.
 */
export function ReadingProgress() {
  const [progress, setProgress] = useState(readScrollProgress);
  const reduceMotion = useMediaQuery("(prefers-reduced-motion: reduce)");

  useEffect(() => {
    function onScroll() {
      setProgress(readScrollProgress());
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  if (reduceMotion) {
    return null;
  }

  return (
    <div
      role="progressbar"
      aria-label="Reading progress"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(progress)}
      className="sticky top-[var(--header-height)] z-40 h-0.5 w-full bg-transparent"
    >
      <div className="h-full bg-primary transition-[width] duration-150" style={{ width: `${progress}%` }} />
    </div>
  );
}
