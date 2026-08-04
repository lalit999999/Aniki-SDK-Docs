"use client";

import { useTheme } from "next-themes";
import { HugeiconsIcon } from "@hugeicons/react";
import { Moon02Icon, Sun03Icon } from "@hugeicons/core-free-icons";

import { Button } from "@/components/ui/button";
import { useMounted } from "@/hooks/use-mounted";

const THEME_ORDER = ["light", "dark", "system"] as const;

/**
 * Cycles light -> dark -> system on click. Renders a stable, inert
 * placeholder until mounted so the icon never flashes the wrong theme
 * during hydration (the resolved theme isn't knowable on the server).
 */
export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const mounted = useMounted();

  if (!mounted) {
    return (
      <Button variant="ghost" size="icon" aria-label="Toggle theme" disabled>
        <HugeiconsIcon icon={Sun03Icon} strokeWidth={2} />
      </Button>
    );
  }

  const current = THEME_ORDER.includes(theme as (typeof THEME_ORDER)[number])
    ? (theme as (typeof THEME_ORDER)[number])
    : "system";

  function cycleTheme() {
    const next = THEME_ORDER[(THEME_ORDER.indexOf(current) + 1) % THEME_ORDER.length];
    setTheme(next);
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={`Theme: ${current}. Click to switch.`}
      onClick={cycleTheme}
    >
      <HugeiconsIcon icon={current === "dark" ? Moon02Icon : Sun03Icon} strokeWidth={2} />
    </Button>
  );
}
