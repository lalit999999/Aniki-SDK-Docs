"use client";

import { useEffect, useState } from "react";

/**
 * Tracks which of the given heading ids is currently active while
 * scrolling, via a single shared `IntersectionObserver` (not one per
 * heading - that would be one observer per TOC entry, up to 108 of them on
 * `api-reference`). `rootMargin` biases the "active" boundary to the upper
 * third of the viewport, so a heading is marked active once it's clearly
 * the section being read rather than only when it touches the very top.
 *
 * @param ids - heading ids in document order, e.g. `doc.toc` flattened.
 * @returns the id of the active heading, or `null` before any heading has
 * been observed (e.g. a heading-less document).
 */
export function useActiveHeading(ids: readonly string[]): string | null {
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    if (ids.length === 0) {
      return;
    }

    const visible = new Set<string>();

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            visible.add(entry.target.id);
          } else {
            visible.delete(entry.target.id);
          }
        }

        const firstVisible = ids.find((id) => visible.has(id));
        if (firstVisible !== undefined) {
          setActiveId(firstVisible);
        }
      },
      { rootMargin: "0px 0px -70% 0px", threshold: 0 },
    );

    const elements = ids
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => el !== null);

    for (const el of elements) {
      observer.observe(el);
    }

    return () => observer.disconnect();
  }, [ids]);

  return activeId;
}
