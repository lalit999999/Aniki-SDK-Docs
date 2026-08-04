"use client";

import { useEffect, useState } from "react";

/**
 * A 2px bar tracking scroll progress through the whole page, mounted just
 * under the header. Disabled under `prefers-reduced-motion: reduce` since
 * the browser-level media query can't be read at build time.
 */
export function ReadingProgress() {
  const [progress, setProgress] = useState(0);
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduceMotion(media.matches);
    const onChange = () => setReduceMotion(media.matches);
    media.addEventListener("change", onChange);

    function onScroll() {
      const scrollable = document.documentElement.scrollHeight - window.innerHeight;
      setProgress(scrollable > 0 ? Math.min(100, (window.scrollY / scrollable) * 100) : 0);
    }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      media.removeEventListener("change", onChange);
      window.removeEventListener("scroll", onScroll);
    };
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
