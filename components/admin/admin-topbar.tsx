"use client";

import { Fragment } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { ThemeToggle } from "@/components/docs/theme-toggle";
import { SignOutButton } from "@/components/admin/sign-out-button";
import { ADMIN_NAV } from "@/lib/admin/nav";

interface Crumb {
  readonly label: string;
  readonly href: string;
}

function labelFor(segment: string, href: string): string {
  const navItem = ADMIN_NAV.find((item) => item.href === href);
  if (navItem !== undefined) {
    return navItem.label;
  }
  return segment.length > 0 ? segment.charAt(0).toUpperCase() + segment.slice(1) : segment;
}

/** Builds a breadcrumb trail from the pathname, one crumb per path
 * segment, labelling any segment that matches a known `ADMIN_NAV` href
 * with its nav label and falling back to a capitalized raw segment
 * otherwise (a content slug, a version id - anything this branch doesn't
 * know the display name for). */
function breadcrumbFor(pathname: string): Crumb[] {
  const segments = pathname.split("/").filter((segment) => segment.length > 0);
  const crumbs: Crumb[] = [];
  let href = "";
  for (const segment of segments) {
    href += `/${segment}`;
    crumbs.push({ label: labelFor(segment, href), href });
  }
  return crumbs;
}

/**
 * The admin shell's header: sidebar toggle, a pathname-derived breadcrumb,
 * the theme toggle (reusing the same `ThemeToggle` the public site uses),
 * the signed-in username, and sign-out.
 */
export function AdminTopbar({ username }: { username: string | null }) {
  const pathname = usePathname();
  const crumbs = breadcrumbFor(pathname);

  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border px-4">
      <SidebarTrigger />
      <Separator orientation="vertical" className="h-4" />
      <Breadcrumb>
        <BreadcrumbList>
          {crumbs.map((crumb, index) => {
            const isLast = index === crumbs.length - 1;
            return (
              <Fragment key={crumb.href}>
                <BreadcrumbItem>
                  {isLast ? (
                    <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
                  ) : (
                    <BreadcrumbLink asChild>
                      <Link href={crumb.href}>{crumb.label}</Link>
                    </BreadcrumbLink>
                  )}
                </BreadcrumbItem>
                {!isLast && <BreadcrumbSeparator />}
              </Fragment>
            );
          })}
        </BreadcrumbList>
      </Breadcrumb>
      <div className="ml-auto flex items-center gap-3">
        {username !== null && <span className="text-sm text-muted-foreground">{username}</span>}
        <ThemeToggle />
        <SignOutButton />
      </div>
    </header>
  );
}
