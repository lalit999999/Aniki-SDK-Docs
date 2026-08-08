"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

const INGEST_URL = "/api/analytics";

export interface AnalyticsCollectorProps {
  /** Documentation version the current page belongs to, or `undefined` for
   * a page with no version of its own. Passed as a prop rather than looked
   * up here: this component must not import `@/lib/content` or any other
   * `server-only` barrel (T9), so the page that already has this value
   * (`doc.meta.version`, `release.meta.docsVersion`) hands it down. */
  versionId?: string;
  /** Fires the beacon outside `NODE_ENV=production` too. For local manual
   * testing only - never set this in a page. */
  force?: boolean;
}

function isDoNotTrackEnabled(): boolean {
  const navigatorDnt = typeof navigator === "object" ? (navigator as { doNotTrack?: string }).doNotTrack : undefined;
  const globalDnt = (globalThis as { doNotTrack?: string }).doNotTrack;
  return navigatorDnt === "1" || globalDnt === "1";
}

function sendBeacon(payload: string): void {
  const canUseSendBeacon = typeof navigator === "object" && typeof navigator.sendBeacon === "function";
  const sent = canUseSendBeacon
    ? navigator.sendBeacon(INGEST_URL, new Blob([payload], { type: "application/json" }))
    : false;

  if (sent || typeof fetch !== "function") {
    return;
  }

  fetch(INGEST_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: payload,
    keepalive: true,
  }).catch(() => undefined);
}

/**
 * Fires one first-party analytics beacon per pathname change (D9). Renders
 * nothing.
 *
 * Mounted from `app/docs/[...slug]/page.tsx` and
 * `app/changelog/[version]/page.tsx` - the root layout belongs to Prompt A
 * (`app/layout.tsx`), so this can't be mounted there yet. A post-merge
 * follow-up can hoist it to the root layout for full-site coverage instead
 * of just these two route trees.
 *
 * No-ops entirely when `navigator.doNotTrack` (or the legacy
 * `globalThis.doNotTrack`) is `"1"`, and outside `NODE_ENV=production`
 * unless `force` is set, so local development browsing never pollutes real
 * numbers. Prefers `navigator.sendBeacon` (survives the page unloading
 * mid-navigation) and falls back to a `keepalive` `fetch` when it isn't
 * available.
 */
export function AnalyticsCollector({ versionId, force = false }: AnalyticsCollectorProps) {
  const pathname = usePathname();
  const lastSentPathname = useRef<string | null>(null);

  useEffect(() => {
    if (!force && process.env.NODE_ENV !== "production") {
      return;
    }
    if (isDoNotTrackEnabled()) {
      return;
    }
    if (pathname === lastSentPathname.current) {
      return;
    }
    lastSentPathname.current = pathname;

    const payload = JSON.stringify({
      path: pathname,
      versionId,
      referrer: typeof document === "object" && document.referrer.length > 0 ? document.referrer : undefined,
    });

    sendBeacon(payload);
  }, [pathname, versionId, force]);

  return null;
}
