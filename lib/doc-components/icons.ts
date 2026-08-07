/**
 * The closed `icon=` vocabulary `:::card` and `:::feature` accept, mapped
 * to verified `@hugeicons/core-free-icons` exports (the Step 8 task
 * brief's own verified-icon-names table) rather than letting an author
 * write a raw package export name - that would be both unguessable
 * (hundreds of near-duplicate variants per concept) and would leak an
 * implementation detail into content files. Kept to about a dozen keys
 * covering the vocabulary the docs actually reference, so every card and
 * feature stays visually consistent instead of authors reaching for
 * slightly different "similar" icons over time.
 */

import { z } from "zod";
import type { IconSvgElement } from "@hugeicons/react";
import {
  ApiIcon,
  Book01Icon,
  CodeIcon,
  DatabaseIcon,
  Idea01Icon,
  PackageIcon,
  PuzzleIcon,
  Rocket01Icon,
  Shield01Icon,
  StarIcon,
  TerminalIcon,
  ZapIcon,
} from "@hugeicons/core-free-icons";

/** Every icon key `icon=` accepts. */
export const ICON_NAMES = [
  "rocket",
  "zap",
  "book",
  "code",
  "terminal",
  "package",
  "puzzle",
  "shield",
  "database",
  "api",
  "star",
  "bulb",
] as const;

export type IconName = (typeof ICON_NAMES)[number];

const ICONS: Record<IconName, IconSvgElement> = {
  rocket: Rocket01Icon,
  zap: ZapIcon,
  book: Book01Icon,
  code: CodeIcon,
  terminal: TerminalIcon,
  package: PackageIcon,
  puzzle: PuzzleIcon,
  shield: Shield01Icon,
  database: DatabaseIcon,
  api: ApiIcon,
  star: StarIcon,
  bulb: Idea01Icon,
};

function isIconName(value: string): value is IconName {
  return (ICON_NAMES as readonly string[]).includes(value);
}

/**
 * Resolves an author-supplied `icon=` value to its glyph, or reports it as
 * an issue naming the bad key and every valid one. Rendering nothing (or
 * silently falling back to a default icon) would hide a typo instead of
 * surfacing it - the same "never silently discard" principle every other
 * validation in this bridge follows.
 *
 * @example
 * ```ts
 * resolveIcon("rocket"); // { ok: true, icon: Rocket01Icon }
 * resolveIcon("banana"); // { ok: false, issue: 'unknown icon "banana" - expected one of rocket, zap, ...' }
 * ```
 */
export function resolveIcon(name: string): { ok: true; icon: IconSvgElement } | { ok: false; issue: string } {
  if (isIconName(name)) {
    return { ok: true, icon: ICONS[name] };
  }
  return {
    ok: false,
    issue: `unknown icon "${name}" - expected one of ${ICON_NAMES.join(", ")}`,
  };
}

/** Looks up an already-validated icon name's glyph, for use in a
 * presentational component that received `icon` as a typed `IconName`
 * prop (post-schema, so the lookup can never miss). */
export function iconFor(name: IconName): IconSvgElement {
  return ICONS[name];
}

/**
 * A Zod schema for an optional `icon=` attribute, built on `resolveIcon`
 * so `:::card`/`:::feature` report a bad icon key the same way every other
 * invalid attribute does - one `DirectiveAttributeError` issue naming the
 * problem, not a silently missing icon.
 */
export function iconAttribute() {
  return z
    .string()
    .optional()
    .transform((value, ctx): IconName | undefined => {
      if (value === undefined) {
        return undefined;
      }
      const result = resolveIcon(value);
      if (!result.ok) {
        ctx.addIssue({ code: "custom", message: result.issue });
        return z.NEVER;
      }
      return value as IconName;
    });
}
