"use client";

import { LeafIcon, MenuIcon, MoonIcon, SunIcon } from "lucide-react";
import { useTheme } from "next-themes";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { LanguageSwitcher } from "@/components/marketing/language-switcher";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Dictionary } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n/config";
import { cn } from "@/lib/utils";

function ThemeToggle({ label }: { label: string }) {
  const { setTheme } = useTheme();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={label}>
          <SunIcon className="size-4 scale-100 rotate-0 transition-transform dark:scale-0 dark:-rotate-90" />
          <MoonIcon className="absolute size-4 scale-0 rotate-90 transition-transform dark:scale-100 dark:rotate-0" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => setTheme("light")}>Light</DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("dark")}>Dark</DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("system")}>System</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function SiteHeader({
  locale,
  t,
  children,
}: {
  locale: Locale;
  t: Dictionary;
  /** The sign-in rail, so it sticks to the viewport with the bar above it. */
  children?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  /*
    Pricing is a page; the rest are sections of the landing page. That mix is
    what broke the nav: the section links were bare `#how-it-works`, so from
    `/pricing` they set a hash on a page that has no such section and nothing
    happened. Every link has to say which page it means.

    On the landing page they stay bare anchors, which the browser scrolls to
    without a navigation. Anywhere else they become `/{locale}#section` and go
    home first. Using the full form on the landing page too would work, but a
    plain `<a>` to the current URL reloads the whole page to scroll a few
    hundred pixels.
  */
  const pathname = usePathname();
  const home = `/${locale}`;
  const onLanding = pathname === home || pathname === `${home}/`;

  const section = (id: string) => (onLanding ? `#${id}` : `${home}#${id}`);

  const links = [
    { href: `/${locale}/pricing`, label: t.nav.pricing, page: true },
    { href: section("languages"), label: t.nav.languages, page: !onLanding },
    { href: section("how-it-works"), label: t.nav.howItWorks, page: !onLanding },
    { href: section("farmers"), label: t.nav.forFarmers, page: !onLanding },
    { href: section("buyers"), label: t.nav.forBuyers, page: !onLanding },
    { href: section("coverage"), label: t.nav.coverage, page: !onLanding },
  ];

  return (
    <header className="bg-background/90 sticky top-0 z-40 border-b backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center gap-4 px-5">
        {/*
          `shrink-0`, because a long nav in Tamil or Malayalam otherwise
          compresses the brand until the two lines collide. And `leading-tight`
          rather than `leading-none`: Indic glyphs are taller than Latin at the
          same font size — the i18n config says so — so a line box of exactly
          1em clips the Tamil and spills it past the bar.
        */}
        <Link
          href={`/${locale}`}
          className="focus-visible:ring-ring flex shrink-0 items-center gap-2.5 rounded-md focus-visible:ring-2 focus-visible:outline-none"
        >
          <span className="bg-primary text-primary-foreground flex size-8 shrink-0 items-center justify-center rounded-md">
            <LeafIcon className="size-4" />
          </span>
          <span className="flex flex-col leading-tight">
            <span className="text-[15px] font-semibold tracking-tight whitespace-nowrap">
              Pasumai Trade
            </span>
            <span lang="ta" className="text-faint text-[11px] whitespace-nowrap">
              பசுமை வர்த்தகம்
            </span>
          </span>
        </Link>

        {/*
          `xl` rather than `lg`. Six labels fit beside the brand and the buttons
          at 1024px in English; in Tamil "எப்படி இயங்குகிறது" alone is wider than
          "How it works" and the row wrapped to two lines inside a fixed-height
          bar, which is what threw the whole header out. The menu button below
          this width is the same answer for every language rather than one that
          happens to hold for English.
        */}
        <nav className="ml-4 hidden items-center gap-0.5 xl:flex">
          {links.map((link) =>
            link.page ? (
              <Link
                key={link.href}
                href={link.href}
                className="text-muted-foreground hover:text-foreground hover:bg-secondary focus-visible:ring-ring rounded-md px-2.5 py-1.5 text-sm whitespace-nowrap transition-colors focus-visible:ring-2 focus-visible:outline-none"
              >
                {link.label}
              </Link>
            ) : (
              <a
                key={link.href}
                href={link.href}
                className="text-muted-foreground hover:text-foreground hover:bg-secondary focus-visible:ring-ring rounded-md px-2.5 py-1.5 text-sm whitespace-nowrap transition-colors focus-visible:ring-2 focus-visible:outline-none"
              >
                {link.label}
              </a>
            ),
          )}
        </nav>

        <div className="ml-auto flex shrink-0 items-center gap-2">
          <LanguageSwitcher current={locale} label={t.common.changeLanguage} />
          <ThemeToggle label={t.nav.theme} />
          {/* "Register free" is two words in English and five in Tamil, so the
              button is allowed to size to its text rather than wrap inside a
              fixed-height bar. */}
          <Button asChild className="hidden whitespace-nowrap md:inline-flex">
            <Link href={`/${locale}/signup?as=farmer`}>{t.nav.registerFree}</Link>
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="xl:hidden"
            aria-label={t.nav.menu}
            aria-expanded={open}
            onClick={() => setOpen((o) => !o)}
          >
            <MenuIcon className="size-4" />
          </Button>
        </div>
      </div>

      <div className={cn("border-t xl:hidden", open ? "block" : "hidden")}>
        <nav className="mx-auto flex w-full max-w-6xl flex-col gap-1 px-5 py-3">
          {links.map((link) =>
            link.page ? (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className="text-muted-foreground hover:text-foreground hover:bg-secondary rounded-md px-3 py-2 text-sm"
              >
                {link.label}
              </Link>
            ) : (
              <a
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className="text-muted-foreground hover:text-foreground hover:bg-secondary rounded-md px-3 py-2 text-sm"
              >
                {link.label}
              </a>
            ),
          )}
          <div className="mt-2 flex flex-col gap-2">
            {/* No generic sign-in here: the strip below the bar is visible on
                mobile too and names all six doors, which beats one that makes
                everyone work out which they are afterwards. */}
            <Button asChild>
              <Link href={`/${locale}/signup?as=farmer`} onClick={() => setOpen(false)}>
                {t.nav.registerFree}
              </Link>
            </Button>
          </div>
        </nav>
      </div>
      {children}
    </header>
  );
}
