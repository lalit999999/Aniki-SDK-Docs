"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowDown01Icon, ArrowUpRight01Icon, Rocket01Icon } from "@hugeicons/core-free-icons";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { docsIndexRoute, getVersions, resolveDocsPath } from "@/lib/versions";
import type { DocsVersion } from "@/lib/versions";

/**
 * Documentation version switcher, rendered in the site header next to the
 * primary nav. Derives the active version from `usePathname()` during
 * render rather than `useEffect` + `useState` (T2: the React Compiler
 * flags that combination as a lint error, and there's no reason to reach
 * for an effect here anyway - `resolveDocsPath` is a pure, synchronous
 * function).
 *
 * Renders nothing outside `/docs`, since there is no "active version" to
 * show anywhere else on the site.
 *
 * Navigates to a version's own index page rather than the equivalent slug
 * in the target version (D7): under `dynamicParams = false`, guessing
 * `/docs/<id>/<current-slug>` would 404 whenever a page exists in one
 * version but not another. Per-page cross-version linking is handled
 * instead by `VersionNotice`, a Server Component that can actually check
 * whether the current page exists in the target version.
 */
export function VersionSwitcher() {
  const pathname = usePathname();

  if (!pathname.startsWith("/docs")) {
    return null;
  }

  const segments = pathname.replace(/^\/docs\/?/, "").split("/").filter(Boolean);
  const resolved = resolveDocsPath(segments);
  const versions = getVersions();
  const activeVersion = versions.find((version) => version.id === resolved?.versionId) ?? versions[0];

  if (activeVersion === undefined) {
    return null;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          {activeVersion.label}
          {activeVersion.status === "latest" && (
            <Badge variant="secondary" className="px-1.5 py-0 text-[10px]">
              Latest
            </Badge>
          )}
          <HugeiconsIcon icon={ArrowDown01Icon} strokeWidth={2} className="size-3.5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Documentation version</DropdownMenuLabel>
        {versions.map((version) => (
          <VersionMenuItem key={version.id} version={version} isActive={version.id === activeVersion.id} />
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/changelog" className="justify-between">
            What&apos;s new
            <HugeiconsIcon icon={ArrowUpRight01Icon} strokeWidth={2} className="size-3.5" />
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function VersionMenuItem({ version, isActive }: { version: DocsVersion; isActive: boolean }) {
  return (
    <DropdownMenuItem asChild>
      <Link
        href={docsIndexRoute(version.id)}
        aria-current={isActive ? "true" : undefined}
        className={cn("flex-col items-start gap-0.5", isActive && "bg-accent")}
      >
        <span className="flex w-full items-center gap-1.5 font-medium text-foreground">
          {version.status === "latest" && <HugeiconsIcon icon={Rocket01Icon} strokeWidth={2} className="size-3.5" />}
          {version.label}
          {version.status !== "latest" && (
            <Badge variant="outline" className="ml-auto text-[10px] capitalize">
              {version.status}
            </Badge>
          )}
        </span>
        <span className="text-xs text-muted-foreground">Released {version.releasedAt}</span>
      </Link>
    </DropdownMenuItem>
  );
}
