"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * `useActiveHeading`'s return value: the id currently highlighted in the
 * table of contents, plus the handler a TOC link's `onClick` wires up to
 * suppress observer flicker while a click-triggered scroll is in flight.
 */
export interface ActiveHeadingState {
  /** The id of the active heading, or `null` before any heading has been
   * observed (e.g. a heading-less document). */
  activeId: string | null;
  /** Call with a heading's id when a TOC link for it is clicked. Marks that
   * heading active immediately and holds it there until the resulting
   * scroll settles, so the observer doesn't flash through every section
   * the browser scrolls past on the way. */
  onAnchorSelect: (id: string) => void;
}

/**
 * Tracks which of the given heading ids is currently active while
 * scrolling, via a single shared `IntersectionObserver` (not one per
 * heading - that would be one observer per TOC entry, up to 108 of them on
 * `api-reference`). `rootMargin` biases the "active" boundary to the upper
 * third of the viewport, so a heading is marked active once it's clearly
 * the section being read rather than only when it touches the very top.
 *
 * Three behaviours the observer alone can't provide:
 *
 * - **Last section.** `rootMargin: "0px 0px -70% 0px"` means a heading near
 *   the bottom of a short final section can never enter the intersection
 *   band, so the observer alone never marks it active. A passive `scroll`
 *   listener checks for "within 2px of the document's bottom" and forces
 *   the last id active in that case.
 * - **Click suppression.** Clicking a TOC link jumps the observer through
 *   every heading the browser scrolls past en route, flickering the active
 *   state. `onAnchorSelect` sets the target active immediately and
 *   suppresses observer writes until the scroll settles (`scrollend` where
 *   supported, a ~700ms timeout fallback otherwise).
 * - **Hash bootstrap.** A page loaded at `#some-heading` should show that
 *   heading active on arrival, before the user has scrolled at all. Read
 *   inside a `requestAnimationFrame` callback (never during render, which
 *   would risk a server/client hydration mismatch since `location.hash` has
 *   no SSR-safe value).
 *
 * @param ids - heading ids in document order, e.g. `doc.toc` flattened.
 */
export function useActiveHeading(ids: readonly string[]): ActiveHeadingState {
  const [activeId, setActiveId] = useState<string | null>(null);
  const suppressed = useRef(false);
  const suppressCleanup = useRef<(() => void) | null>(null);

  useEffect(() => {
    return () => {
      suppressCleanup.current?.();
      suppressCleanup.current = null;
    };
  }, []);

  useEffect(() => {
    if (ids.length === 0) {
      return;
    }

    const visible = new Set<string>();
    const lastId = ids[ids.length - 1];

    const observer = new IntersectionObserver(
      (entries) => {
        if (suppressed.current) {
          return;
        }

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

    const handleScroll = () => {
      if (suppressed.current || lastId === undefined) {
        return;
      }
      const atBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2;
      if (atBottom) {
        setActiveId(lastId);
      }
    };
    window.addEventListener("scroll", handleScroll, { passive: true });

    const frame = requestAnimationFrame(() => {
      const hashId = window.location.hash.slice(1);
      if (hashId !== "" && ids.includes(hashId)) {
        setActiveId(hashId);
      }
    });

    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", handleScroll);
      cancelAnimationFrame(frame);
    };
  }, [ids]);

  const onAnchorSelect = useCallback((id: string) => {
    setActiveId(id);
    suppressed.current = true;
    suppressCleanup.current?.();

    const release = () => {
      suppressed.current = false;
      suppressCleanup.current = null;
    };

    if ("onscrollend" in window) {
      const handleScrollEnd = () => {
        release();
        window.removeEventListener("scrollend", handleScrollEnd);
      };
      window.addEventListener("scrollend", handleScrollEnd);
      suppressCleanup.current = () => window.removeEventListener("scrollend", handleScrollEnd);
    } else {
      const timeout = setTimeout(release, 700);
      suppressCleanup.current = () => clearTimeout(timeout);
    }
  }, []);

  return { activeId, onAnchorSelect };
}
