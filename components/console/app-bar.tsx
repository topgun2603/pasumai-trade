"use client";

import Link from "next/link";
import type { ReactNode } from "react";

import { BrandLogo } from "@/components/marketing/brand-mark";
import { ThemeToggle } from "@/components/console/theme-toggle";
import { LanguageSwitcher } from "@/components/marketing/language-switcher";
import type { Locale } from "@/lib/i18n/config";

/**
 * The bar across the top of every console on a phone.
 *
 * ## What was wrong
 *
 * The public site's header carries the mark, the name, the language control
 * and the theme control at every width. Signing in threw all four away on a
 * handset:
 *
 *  - the farm console had no top bar at all below `md`, only the bottom link
 *    bar, so a farmer had the mark and both controls until the moment they
 *    signed in and then none of them;
 *  - the buying, agency and admin drawers had a bar, but it carried the menu
 *    button and a name and nothing else.
 *
 * The language control is the one that matters. Both rails keep it pinned to
 * the foot of a `hidden md:flex` panel, which means the way out of a language
 * you cannot read was reachable only on a screen most of this platform's
 * readers do not own. Somebody who picked the wrong language on the public site
 * and signed in was simply stuck in it.
 *
 * ## Why one component
 *
 * There are four console shells and they had four different answers, which is
 * how the platform ended up with two byte-identical theme toggles and one
 * console with no toggle at all. This is the bar; a shell supplies what is
 * particular to it and nothing else.
 *
 * `md:hidden`, because above that width the rails already carry all of this and
 * a second copy across the top would be the same controls twice.
 */
export function ConsoleAppBar({
  locale,
  brandName,
  homeHref,
  subtitle,
  languageLabel,
  themeLabel,
  leading,
  children,
}: {
  /** Chosen by the cookie, resolved on the server. See lib/i18n/console.ts. */
  locale: Locale;
  /** `t.brand.name`, in the reader's script. */
  brandName: string;
  /**
   * Where tapping the mark goes — this console's home, from `HOME_FOR_ROLE`.
   *
   * Read from there rather than written out per shell, so the logo lands
   * somebody in exactly the place signing in would have. Not the public
   * landing page: this bar is only ever drawn behind a session, and sending a
   * farmer from their console back out to the marketing site is a way out of
   * the application dressed as a way home.
   */
  homeHref: string;
  /** Which console this is, or whose it is. The rail is not there to say so. */
  subtitle?: string;
  languageLabel: string;
  themeLabel: string;
  /** Anything that opens navigation — a drawer trigger, where there is one. */
  leading?: ReactNode;
  /** Anything the console wants beside the controls — a bell, usually. */
  children?: ReactNode;
}) {
  return (
    <header className="bg-sidebar border-sidebar-border sticky top-0 z-40 flex h-12 shrink-0 items-center gap-2 border-b px-3 md:hidden">
      {leading}

      {/*
        Mark and name in one link, not two.

        They read as a single object, so two adjacent targets doing the same
        thing would only be two ways to miss. `min-w-0` survives the flex
        parent so the name still truncates rather than pushing the controls off
        a narrow screen.
      */}
      <Link
        href={homeHref}
        className="focus-visible:ring-ring flex min-w-0 items-center gap-2 rounded-md focus-visible:ring-2 focus-visible:outline-none"
      >
        {/* The mark in its white circle, as the rails and the sign-in doors
          draw it. A photograph needs a light ground; the circle is what gives
          it one on a bar that follows the theme. */}
        <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-white">
          <BrandLogo className="size-4" />
        </span>

        <span className="flex min-w-0 flex-col leading-tight">
          <span className="truncate text-sm font-semibold">{brandName}</span>
          {subtitle ? (
            <span className="text-faint truncate text-xs">{subtitle}</span>
          ) : null}
        </span>
      </Link>

      {/*
        `gap-0.5` rather than the bar's `gap-2`: these are icon buttons with
        their own padding, and at the wider gap three of them plus a bell push
        the name into truncation on a 320px screen.
      */}
      <span className="ml-auto flex shrink-0 items-center gap-0.5">
        {children}
        <LanguageSwitcher current={locale} label={languageLabel} compact />
        <ThemeToggle label={themeLabel} compact />
      </span>
    </header>
  );
}
